#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=deploy-lib.sh
source "${SCRIPT_DIR}/deploy-lib.sh"
# shellcheck source=finish-cleanup.sh
source "${SCRIPT_DIR}/finish-cleanup.sh"

init_deploy_trap_vars
install_deploy_traps

acquire_deploy_lock
cup_survey_cd
"${SCRIPT_DIR}/reconcile-deploy-state.sh"

[[ -f "${DEPLOY_STATE_FILE}" ]] || abort "deploy-state missing"
compatible="$(journal_field_from_state previous_manual_rollback_compatible)"
[[ "${compatible}" == "True" || "${compatible}" == "true" ]] || abort "manual rollback not compatible"
journal_exists && abort "pending transaction exists"

ACTIVE_SLOT="$(journal_field_from_state active_slot)"
INACTIVE_SLOT="$([[ "${ACTIVE_SLOT}" == "blue" ]] && echo green || echo blue)"
PREVIOUS_IMAGE="$(journal_field_from_state previous_image)"
PREVIOUS_IMAGE_ID="$(journal_field_from_state previous_image_id)"
ROLLBACK_IMAGE_REF="$(resolve_previous_image_ref)"
read_image_identity_from_labels "${ROLLBACK_IMAGE_REF}"

CUP_RELEASE_TAG="${EXPECTED_RELEASE_ID}"
CANDIDATE_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "${ROLLBACK_IMAGE_REF}")"
TARGET_IMAGE_REF="${ROLLBACK_IMAGE_REF}"
TARGET_PORT="$(slot_port "${INACTIVE_SLOT}")"
PREVIOUS_PORT="$(slot_port "${ACTIVE_SLOT}")"

export TARGET_IMAGE_REF TARGET_IMAGE_ID="${CANDIDATE_IMAGE_ID}" TARGET_RELEASE_ID="${CUP_RELEASE_TAG}"
export TARGET_GIT_SHA="${EXPECTED_GIT_SHA}" PREVIOUS_PORT TARGET_PORT
export PREVIOUS_SLOT="${ACTIVE_SLOT}" TARGET_SLOT="${INACTIVE_SLOT}"
export PREVIOUS_IMAGE="$(journal_field_from_state active_image)" PREVIOUS_IMAGE_ID="$(journal_field_from_state active_image_id)"
export PREVIOUS_STATE_EXISTED=true ROLLBACK_INTENT=true
"${SCRIPT_DIR}/write-journal-prepared.sh"
TRANSACTION_STARTED=1

export DEPLOY_TARGET_SLOT="${INACTIVE_SLOT}" DEPLOY_TARGET_IMAGE="${ROLLBACK_IMAGE_REF}"
"${SCRIPT_DIR}/write-compose-images-env.sh"
DEPLOY_PHASE=STARTED
compose_prod up -d --no-build --no-deps "app-${INACTIVE_SLOT}"
"${SCRIPT_DIR}/wait-for-health.sh" "${TARGET_PORT}"
"${SCRIPT_DIR}/smoke-inactive-slot.sh" "${TARGET_PORT}" "${CUP_RELEASE_TAG}" "${EXPECTED_GIT_SHA}"

DEPLOY_PHASE=SWITCHING
"${SCRIPT_DIR}/switch-upstream.sh" "${TARGET_PORT}"
DEPLOY_PHASE=SWITCHED

"${SCRIPT_DIR}/commit-deploy-state.sh" \
  "${INACTIVE_SLOT}" "${ROLLBACK_IMAGE_REF}" "${CANDIDATE_IMAGE_ID}" \
  "${PREVIOUS_IMAGE}" "${PREVIOUS_IMAGE_ID}" "${TARGET_PORT}"
DEPLOY_PHASE=COMMITTED
"${SCRIPT_DIR}/smoke-public.sh" "${CUP_RELEASE_TAG}" "${EXPECTED_GIT_SHA}"
"${PYTHON}" - <<'PY'
import os, sys
sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from state_ops import mark_verified, update_journal_phase
mark_verified(os.environ["DEPLOY_STATE_FILE"])
update_journal_phase(os.environ["JOURNAL_FILE"], "VERIFIED")
PY
DEPLOY_PHASE=VERIFIED
"${SCRIPT_DIR}/observe-public.sh" "${CUP_RELEASE_TAG}" "${EXPECTED_GIT_SHA}"
"${PYTHON}" - <<'PY'
import os, sys
sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from state_ops import mark_traffic_committed
mark_traffic_committed(os.environ["DEPLOY_STATE_FILE"])
PY
DEPLOY_PHASE=CLEANUP
rm -f "${JOURNAL_FILE}"
_finish_cleanup
trap - ERR INT TERM
release_deploy_lock
echo "cup-survey-rollback: OK"
