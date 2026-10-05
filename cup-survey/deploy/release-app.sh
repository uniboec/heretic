#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=deploy-lib.sh
source "${SCRIPT_DIR}/deploy-lib.sh"
# shellcheck source=release-image-retention.sh
source "${SCRIPT_DIR}/release-image-retention.sh"
# shellcheck source=finish-cleanup.sh
source "${SCRIPT_DIR}/finish-cleanup.sh"

init_deploy_trap_vars
install_deploy_traps
cleanup_build_context() { [[ -n "${BUILD_CONTEXT_DIR:-}" ]] && rm -rf "${BUILD_CONTEXT_DIR}"; }

if [[ "${CUP_DISABLE_LAZY_RECONCILE:-0}" == "1" && "${CUP_ALLOW_RELEASE_APP_DURING_RECOVERY:-0}" != "1" ]]; then
  abort "post-event recovery active: use deploy-cup26-prod-local-build.py --upload-only --rc (not release-app.sh)"
fi

acquire_deploy_lock
cup_survey_cd

RESUME_RELEASE=0
# shellcheck disable=SC1090
source "${SCRIPT_DIR}/reconcile-deploy-state.sh"

if [[ ! -f "${DEPLOY_STATE_FILE}" ]]; then
  abort "deploy-state missing — run bootstrap-blue-green.sh first"
fi

if [[ "${RESUME_RELEASE}" -eq 1 ]]; then
  restore_transaction_runtime_context
  PREVIOUS_IMAGE="$(journal_field previous_image)"
  PREVIOUS_IMAGE_ID="$(journal_field previous_image_id)"
  METADATA_FILE="${METADATA_FILE:-}"
else
  ACTIVE_SLOT="$(journal_field_from_state active_slot)"
  INACTIVE_SLOT="$([[ "${ACTIVE_SLOT}" == "blue" ]] && echo green || echo blue)"
  PREVIOUS_IMAGE="$(journal_field_from_state active_image)"
  PREVIOUS_IMAGE_ID="$(journal_field_from_state active_image_id)"
  PREVIOUS_PORT="$(slot_port "${ACTIVE_SLOT}")"
  TARGET_PORT="$(slot_port "${INACTIVE_SLOT}")"

  while IFS= read -r line; do
    case "${line}" in
      PREVIOUS_IMAGE_ID=*) PREVIOUS_IMAGE_ID="${line#PREVIOUS_IMAGE_ID=}" ;;
      PREVIOUS_CONTAINER_ID=*) PREVIOUS_CONTAINER_ID="${line#PREVIOUS_CONTAINER_ID=}" ;;
    esac
  done < <("${SCRIPT_DIR}/prevalidate-production-state.sh")

  ensure_previous_image_protected "${PREVIOUS_IMAGE_ID}"
  "${SCRIPT_DIR}/ensure-payment-proofs-storage.sh"
  "${SCRIPT_DIR}/backup-payment-proofs.sh"
  "${SCRIPT_DIR}/check-deploy-resources.sh"

  if [[ "${CUP_SKIP_BUILD:-0}" == "1" ]]; then
    : "${CUP_RELEASE_TAG:?CUP_RELEASE_TAG required when CUP_SKIP_BUILD=1}"
    : "${EXPECTED_GIT_SHA:?EXPECTED_GIT_SHA required when CUP_SKIP_BUILD=1}"
    echo "CUP_SKIP_BUILD=1 — using pre-loaded release images"
    TARGET_IMAGE_REF="cup-survey-app:${CUP_RELEASE_TAG}"
    CANDIDATE_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "${TARGET_IMAGE_REF}")"
    export CANDIDATE_IMAGE_ID
    "${SCRIPT_DIR}/verify-migrate-image-labels.sh" "${CUP_RELEASE_TAG}"
    read_image_identity_from_labels "${TARGET_IMAGE_REF}"
  else
    eval "$("${SCRIPT_DIR}/ensure-clean-git.sh")"
    # shellcheck disable=SC1090
    source "${SCRIPT_DIR}/prepare-immutable-build-context.sh"
    trap cleanup_build_context EXIT

    eval "$("${SCRIPT_DIR}/build-release-images.sh")"
    DEPLOY_PHASE=BUILT

    TARGET_IMAGE_REF="cup-survey-app:${CUP_RELEASE_TAG}"
    ensure_new_release_tag "${CANDIDATE_IMAGE_ID}" "${TARGET_IMAGE_REF}"
    "${SCRIPT_DIR}/verify-migrate-image-labels.sh" "${CUP_RELEASE_TAG}"
    read_image_identity_from_labels "${TARGET_IMAGE_REF}"
  fi

  METADATA_FILE="$(mktemp /tmp/cup-survey-merge-meta.XXXXXX.json)"
  "${SCRIPT_DIR}/merge-static-assets.sh" "${TARGET_IMAGE_REF}" "${CANDIDATE_IMAGE_ID}" "${METADATA_FILE}"
  "${SCRIPT_DIR}/pre-switch-static-check.sh" "${METADATA_FILE}"

  MIG_STATUS="$("${SCRIPT_DIR}/check-migration-status.sh" "${CUP_RELEASE_TAG}")"
  if [[ "${MIG_STATUS}" == "BROKEN" ]]; then abort "migration status BROKEN"; fi
  if [[ "$("${SCRIPT_DIR}/needs-predeploy-db-backup.sh" "${CUP_RELEASE_TAG}")" == "required" ]]; then
    "${SCRIPT_DIR}/backup-postgres.sh"
  fi
  if [[ "${MIG_STATUS}" == "PENDING" ]]; then
    "${SCRIPT_DIR}/run-migrations.sh" "${CUP_RELEASE_TAG}"
  fi

  export TARGET_IMAGE_REF TARGET_IMAGE_ID="${CANDIDATE_IMAGE_ID}" TARGET_RELEASE_ID="${CUP_RELEASE_TAG}"
  export TARGET_GIT_SHA="${EXPECTED_GIT_SHA}" PREVIOUS_PORT TARGET_PORT
  export PREVIOUS_SLOT="${ACTIVE_SLOT}" TARGET_SLOT="${INACTIVE_SLOT}"
  export PREVIOUS_IMAGE PREVIOUS_IMAGE_ID PREVIOUS_STATE_EXISTED=true
  "${SCRIPT_DIR}/write-journal-prepared.sh"
  TRANSACTION_STARTED=1

  export DEPLOY_TARGET_SLOT="${INACTIVE_SLOT}" DEPLOY_TARGET_IMAGE="${TARGET_IMAGE_REF}"
  "${SCRIPT_DIR}/write-compose-images-env.sh"
  DEPLOY_PHASE=STARTED
  compose_prod up -d --no-build --no-deps "app-${INACTIVE_SLOT}"
fi

if [[ "${DEPLOY_PHASE}" == "STARTED" || "${DEPLOY_PHASE}" == "INIT" ]]; then
  "${SCRIPT_DIR}/wait-for-health.sh" "${TARGET_PORT}"
  "${SCRIPT_DIR}/smoke-inactive-slot.sh" "${TARGET_PORT}" "${CUP_RELEASE_TAG}" "${EXPECTED_GIT_SHA}"
fi

if [[ "${DEPLOY_PHASE}" == "STARTED" || "${DEPLOY_PHASE}" == "INIT" ]]; then
  DEPLOY_PHASE=SWITCHING
  "${SCRIPT_DIR}/switch-upstream.sh" "${TARGET_PORT}"
  DEPLOY_PHASE=SWITCHED
fi

if [[ "${DEPLOY_PHASE}" == "SWITCHED" ]]; then
  "${SCRIPT_DIR}/commit-deploy-state.sh" \
    "${INACTIVE_SLOT}" "${TARGET_IMAGE_REF}" "${CANDIDATE_IMAGE_ID}" \
    "${PREVIOUS_IMAGE}" "${PREVIOUS_IMAGE_ID}" "${TARGET_PORT}"
  DEPLOY_PHASE=COMMITTED
fi

if [[ "${DEPLOY_PHASE}" == "COMMITTED" || "${DEPLOY_PHASE}" == "OBSERVING" ]]; then
  "${SCRIPT_DIR}/smoke-public.sh" "${CUP_RELEASE_TAG}" "${EXPECTED_GIT_SHA}"
  "${PYTHON}" - <<'PY'
import os, sys
sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from state_ops import mark_verified, update_journal_phase
mark_verified(os.environ["DEPLOY_STATE_FILE"])
update_journal_phase(os.environ["JOURNAL_FILE"], "VERIFIED")
PY
  DEPLOY_PHASE=VERIFIED
fi

if [[ "${DEPLOY_PHASE}" == "VERIFIED" || "${DEPLOY_PHASE}" == "COMMITTED" ]]; then
  "${SCRIPT_DIR}/observe-public.sh" "${CUP_RELEASE_TAG}" "${EXPECTED_GIT_SHA}"
  DEPLOY_PHASE=OBSERVING
fi

if [[ "${DEPLOY_PHASE}" == "OBSERVING" || "${DEPLOY_PHASE}" == "VERIFIED" ]]; then
  "${PYTHON}" - <<'PY'
import os, sys
sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from state_ops import mark_traffic_committed
mark_traffic_committed(os.environ["DEPLOY_STATE_FILE"])
PY
  DEPLOY_PHASE=CLEANUP
  rm -f "${JOURNAL_FILE}"
fi

if [[ "${RESUME_RELEASE}" -eq 0 && -n "${METADATA_FILE:-}" && -f "${METADATA_FILE}" ]]; then
  "${SCRIPT_DIR}/promote-static-manifest.sh" "${METADATA_FILE}"
fi

_finish_cleanup
[[ -n "${METADATA_FILE:-}" ]] && rm -f "${METADATA_FILE}"
trap - ERR INT TERM EXIT
release_deploy_lock
echo "release-app: OK ${CUP_RELEASE_TAG}"
