#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=deploy-lib.sh
source "${SCRIPT_DIR}/deploy-lib.sh"
# shellcheck source=finish-cleanup.sh
source "${SCRIPT_DIR}/finish-cleanup.sh"

RESUME_RELEASE=0
BLOCK_NEW_DEPLOY=0

# shellcheck disable=SC1090
source "${SCRIPT_DIR}/recover-pending-switch.sh"

if journal_exists; then
  echo "reconcile: pending journal detected — running recovery"
  recovery_out="$(_recover_pending_switch 2>&1)" || abort "recovery failed: ${recovery_out}"
  echo "${recovery_out}"
  if grep -q 'RECOVERY_RESULT=RESUME_STEP_N' <<<"${recovery_out}"; then
    RESUME_RELEASE=1
  fi
  if grep -q 'RECOVERY_RESULT=COMMITTED\|RECOVERY_RESULT=PARTIAL_ROLLBACK_FIXED\|RECOVERY_RESULT=ABORTED_CANDIDATE\|RECOVERY_RESULT=ROLLED_BACK' <<<"${recovery_out}"; then
    RESUME_RELEASE=0
  fi
elif [[ -f "${DEPLOY_STATE_FILE}" ]]; then
  traffic="$(journal_field_from_state traffic_status 2>/dev/null || echo "")"
  verification="$(journal_field_from_state verification_status 2>/dev/null || echo "")"
  if [[ "${verification}" == "verified" && "${traffic}" != "committed" ]]; then
    echo "reconcile: observation interrupted without journal — attempting finish"
    CUP_RELEASE_TAG="$(journal_field_from_state active_image 2>/dev/null | xargs -I{} docker image inspect --format '{{index .Config.Labels "cup.release_id"}}' {} 2>/dev/null || true)"
    EXPECTED_GIT_SHA="$(journal_field_from_state active_image 2>/dev/null | xargs -I{} docker image inspect --format '{{index .Config.Labels "cup.git_sha"}}' {} 2>/dev/null || true)"
    if [[ -n "${CUP_RELEASE_TAG}" && -n "${EXPECTED_GIT_SHA}" ]]; then
      if "${SCRIPT_DIR}/observe-public.sh" "${CUP_RELEASE_TAG}" "${EXPECTED_GIT_SHA}" 3 5; then
        "${PYTHON}" - <<'PY'
import os, sys
sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from state_ops import mark_traffic_committed
mark_traffic_committed(os.environ["DEPLOY_STATE_FILE"])
PY
        _finish_cleanup
        echo "reconcile: observation finished"
      else
        BLOCK_NEW_DEPLOY=1
      fi
    else
      BLOCK_NEW_DEPLOY=1
    fi
  fi
fi

"${SCRIPT_DIR}/write-compose-images-env.sh"

cleanup_status="$(journal_field_from_state cleanup_status 2>/dev/null || echo "")"
if [[ "${cleanup_status}" == "pending" || "${cleanup_status}" == "failed" ]]; then
  _finish_cleanup
fi

export CLEANUP_STATUS="${cleanup_status}"
export DEPLOY_STATE_FILE MANIFEST_PATH
if ! "${PYTHON}" "${SCRIPT_DIR}/manifest_gate.py"; then
  echo "reconcile: manifest/state gate failed" >&2
  BLOCK_NEW_DEPLOY=1
fi

if [[ "${BLOCK_NEW_DEPLOY}" -eq 1 && "${RESUME_RELEASE}" -eq 0 ]]; then
  abort "deploy blocked: repair manifest/state consistency before new release"
fi

if [[ "${RESUME_RELEASE}" -eq 1 ]]; then
  export RESUME_RELEASE=1
fi

echo "reconcile-deploy-state: OK"
