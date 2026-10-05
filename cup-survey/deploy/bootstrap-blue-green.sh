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
# shellcheck disable=SC1090
source "${SCRIPT_DIR}/recover-bootstrap-pending-switch.sh"

init_deploy_trap_vars
install_deploy_traps
cleanup_build_context() { [[ -n "${BUILD_CONTEXT_DIR:-}" ]] && rm -rf "${BUILD_CONTEXT_DIR}"; }

RESUME_BOOTSTRAP=0
bootstrap_entry_gate() {
  if [[ -f "${DEPLOY_STATE_FILE}" ]]; then
    traffic="$(journal_field_from_state traffic_status 2>/dev/null || echo "")"
    if [[ "${traffic}" == "committed" ]]; then
      abort "bootstrap already complete — use release-app.sh"
    fi
  fi
  if journal_exists; then
    result="$(_recover_bootstrap_pending_switch 2>&1 || true)"
    echo "${result}"
    case "${result}" in
      *COMMITTED_BLUE_GREEN*) exit 0 ;;
      *ROLLED_BACK_TO_LEGACY*) return 0 ;;
      *RESUME_STEP_N*) restore_transaction_runtime_context; RESUME_BOOTSTRAP=1; return 0 ;;
      *RECOVERY_FAILED*) abort "bootstrap recovery failed" ;;
    esac
  fi
  if [[ -f "${DEPLOY_STATE_FILE}" || -f "${JOURNAL_FILE}" ]]; then
    abort "ambiguous bootstrap state — manual recovery required"
  fi
  curl -fsS --max-time 10 "http://127.0.0.1:${BLUE_PORT}/api/health" >/dev/null || abort "legacy not healthy on :${BLUE_PORT}"
}

acquire_deploy_lock
cup_survey_cd
bootstrap_entry_gate

if [[ "${RESUME_BOOTSTRAP}" -eq 0 ]]; then
  LEGACY_CONTAINER_ID="$(docker ps -qf "publish=${BLUE_PORT}" | head -1)"
  [[ -n "${LEGACY_CONTAINER_ID}" ]] || abort "legacy container not found on :${BLUE_PORT}"
  LEGACY_IMAGE_ID="$(docker inspect "${LEGACY_CONTAINER_ID}" --format '{{.Image}}')"
  LEGACY_IMAGE_REF="$(docker inspect "${LEGACY_CONTAINER_ID}" --format '{{.Config.Image}}')"

  export CUP_BLUE_IMAGE="${LEGACY_IMAGE_REF}" CUP_GREEN_IMAGE="${LEGACY_IMAGE_REF}"
  "${SCRIPT_DIR}/write-compose-images-env.sh"
  "${SCRIPT_DIR}/network-transition.sh"
  "${SCRIPT_DIR}/backup-postgres.sh"

  if [[ "${CUP_SKIP_BUILD:-0}" == "1" ]]; then
    : "${CUP_RELEASE_TAG:?CUP_RELEASE_TAG required when CUP_SKIP_BUILD=1}"
    : "${EXPECTED_GIT_SHA:?EXPECTED_GIT_SHA required when CUP_SKIP_BUILD=1}"
    echo "CUP_SKIP_BUILD=1 — skipping git/build context and VPS image build (expect pre-loaded release images)"
    TARGET_IMAGE_REF="cup-survey-app:${CUP_RELEASE_TAG}"
    CANDIDATE_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "${TARGET_IMAGE_REF}")"
    export CANDIDATE_IMAGE_ID
  else
    eval "$("${SCRIPT_DIR}/ensure-clean-git.sh")"
    # shellcheck disable=SC1090
    source "${SCRIPT_DIR}/prepare-immutable-build-context.sh"
    trap cleanup_build_context EXIT
    eval "$("${SCRIPT_DIR}/build-release-images.sh")"
  fi

  TARGET_IMAGE_REF="cup-survey-app:${CUP_RELEASE_TAG}"
  ensure_new_release_tag "${CANDIDATE_IMAGE_ID}" "${TARGET_IMAGE_REF}"
  "${SCRIPT_DIR}/verify-migrate-image-labels.sh" "${CUP_RELEASE_TAG}"
  read_image_identity_from_labels "${TARGET_IMAGE_REF}"
  export DEPLOY_TARGET_SLOT=green DEPLOY_TARGET_IMAGE="${TARGET_IMAGE_REF}"
  "${SCRIPT_DIR}/write-compose-images-env.sh"

  METADATA_FILE="$(mktemp /tmp/cup-survey-merge-meta.XXXXXX.json)"
  "${SCRIPT_DIR}/merge-static-assets.sh" "${TARGET_IMAGE_REF}" "${CANDIDATE_IMAGE_ID}" "${METADATA_FILE}"
  "${SCRIPT_DIR}/pre-switch-static-check.sh" "${METADATA_FILE}"
  "${SCRIPT_DIR}/run-migrations.sh" "${CUP_RELEASE_TAG}"

  export TARGET_IMAGE_REF TARGET_IMAGE_ID="${CANDIDATE_IMAGE_ID}" TARGET_RELEASE_ID="${CUP_RELEASE_TAG}" TARGET_GIT_SHA="${EXPECTED_GIT_SHA}"
  export PREVIOUS_PORT="${BLUE_PORT}" TARGET_PORT="${GREEN_PORT}" PREVIOUS_SLOT=blue TARGET_SLOT=green
  export PREVIOUS_IMAGE="${LEGACY_IMAGE_REF}" PREVIOUS_IMAGE_ID="${LEGACY_IMAGE_ID}" PREVIOUS_STATE_EXISTED=false
  LEGACY_PREVIOUS_IDENTITY_JSON="$(printf '{"container_id":"%s","image_id":"%s","port":%s}' "${LEGACY_CONTAINER_ID}" "${LEGACY_IMAGE_ID}" "${BLUE_PORT}")"
  export LEGACY_PREVIOUS_IDENTITY_JSON
  "${SCRIPT_DIR}/write-journal-prepared.sh"
  TRANSACTION_STARTED=1
  DEPLOY_PHASE=STARTED
  compose_prod up -d --no-build --no-deps app-green
else
  LEGACY_CONTAINER_ID="$("${PYTHON}" - <<'PY'
import os, sys
sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from state_ops import load
journal = load(os.environ["JOURNAL_FILE"]) or {}
legacy = journal.get("legacy_previous_identity") or {}
print(legacy.get("container_id", ""))
PY
)"
  METADATA_FILE=""
fi

if [[ "${DEPLOY_PHASE}" == "STARTED" || "${DEPLOY_PHASE}" == "INIT" ]]; then
  "${SCRIPT_DIR}/wait-for-health.sh" "${TARGET_PORT:-${GREEN_PORT}}"
  "${SCRIPT_DIR}/smoke-inactive-slot.sh" "${TARGET_PORT:-${GREEN_PORT}}" "${CUP_RELEASE_TAG}" "${EXPECTED_GIT_SHA}"
fi

if [[ "${DEPLOY_PHASE}" == "STARTED" || "${DEPLOY_PHASE}" == "INIT" ]]; then
  DEPLOY_PHASE=SWITCHING
  "${SCRIPT_DIR}/switch-upstream.sh" "${TARGET_PORT:-${GREEN_PORT}}"
  DEPLOY_PHASE=SWITCHED
fi

if [[ "${DEPLOY_PHASE}" == "SWITCHED" ]]; then
  "${SCRIPT_DIR}/commit-deploy-state.sh" green "${TARGET_IMAGE_REF}" "${CANDIDATE_IMAGE_ID}" \
    "${PREVIOUS_IMAGE}" "${PREVIOUS_IMAGE_ID}" "${TARGET_PORT:-${GREEN_PORT}}"
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
fi

"${PYTHON}" - <<'PY'
import os, sys
sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from state_ops import mark_traffic_committed
mark_traffic_committed(os.environ["DEPLOY_STATE_FILE"])
PY
DEPLOY_PHASE=CLEANUP
rm -f "${JOURNAL_FILE}"

if [[ -n "${METADATA_FILE:-}" && -f "${METADATA_FILE}" ]]; then
  "${SCRIPT_DIR}/promote-static-manifest.sh" "${METADATA_FILE}"
fi

if [[ -n "${LEGACY_CONTAINER_ID:-}" ]]; then
  docker stop -t "${DRAIN_TIMEOUT}" "${LEGACY_CONTAINER_ID}" 2>/dev/null || true
fi
_finish_cleanup
[[ -n "${METADATA_FILE:-}" ]] && rm -f "${METADATA_FILE}"
trap - ERR INT TERM EXIT
release_deploy_lock
echo "bootstrap-blue-green: OK"
