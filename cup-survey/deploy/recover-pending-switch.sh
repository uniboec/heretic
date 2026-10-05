#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=deploy-lib.sh
source "${SCRIPT_DIR}/deploy-lib.sh"
# shellcheck source=finish-cleanup.sh
source "${SCRIPT_DIR}/finish-cleanup.sh"

_finish_observation_commit() {
  "${SCRIPT_DIR}/observe-public.sh" "${CUP_RELEASE_TAG}" "${EXPECTED_GIT_SHA}" || return 1
  "${PYTHON}" - <<'PY'
import os, sys
sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from state_ops import mark_traffic_committed
mark_traffic_committed(os.environ["DEPLOY_STATE_FILE"])
PY
  rm -f "${JOURNAL_FILE}"
  _finish_cleanup
}

_finish_verification_pipeline() {
  "${SCRIPT_DIR}/smoke-public.sh" "${CUP_RELEASE_TAG}" "${EXPECTED_GIT_SHA}" || return 1
  "${PYTHON}" - <<'PY'
import os, sys
sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from state_ops import mark_verified, update_journal_phase
mark_verified(os.environ["DEPLOY_STATE_FILE"])
update_journal_phase(os.environ["JOURNAL_FILE"], "VERIFIED")
PY
  _finish_observation_commit
}

_recover_pending_switch() {
  [[ -f "${JOURNAL_FILE}" ]] || return 0

  local action
  action="$("${PYTHON}" "${SCRIPT_DIR}/recovery_matrix.py" classify)"
  echo "recovery action=${action}"
  print_recovery_diagnostics

  case "${action}" in
    PARTIAL_ROLLBACK)
      recover_partial_rollback
      echo "RECOVERY_RESULT=PARTIAL_ROLLBACK_FIXED"
      return 0
      ;;
    STALE_JOURNAL_CLOSE|COMMITTED_STALE_JOURNAL)
      rm -f "${JOURNAL_FILE}"
      _finish_cleanup
      echo "RECOVERY_RESULT=COMMITTED"
      return 0
      ;;
    FINISH_OBSERVATION)
      restore_transaction_runtime_context
      _finish_observation_commit
      echo "RECOVERY_RESULT=COMMITTED"
      return 0
      ;;
    FINISH_VERIFICATION)
      restore_transaction_runtime_context
      _finish_verification_pipeline
      echo "RECOVERY_RESULT=COMMITTED"
      return 0
      ;;
    ROLLBACK)
      restore_transaction_runtime_context
      if rollback_traffic_to_previous; then
        close_pending_journal
        echo "RECOVERY_RESULT=ROLLED_BACK"
        return 0
      fi
      abort "rollback failed"
      ;;
    ABORT_CANDIDATE)
      INACTIVE_SLOT="$(journal_field target_slot)"
      if stop_inactive_slot && verify_inactive_slot_stopped; then
        delete_prepared_journal_if_exists
        echo "RECOVERY_RESULT=ABORTED_CANDIDATE"
        return 0
      fi
      abort "failed to stop candidate slot"
      ;;
    RESUME_AFTER_SWITCH)
      restore_transaction_runtime_context
      DEPLOY_PHASE=SWITCHED
      echo "RECOVERY_RESULT=RESUME_STEP_N"
      return 0
      ;;
    RESUME_PREPARED)
      restore_transaction_runtime_context
      echo "RECOVERY_RESULT=RESUME_STEP_N"
      return 0
      ;;
    OBSERVATION_INTERRUPTED)
      abort "observation interrupted without journal — manual recovery required"
      ;;
    MANUAL_RECOVERY|NO_JOURNAL)
      print_recovery_diagnostics >&2
      abort "unrecoverable pending switch — see fact matrix above"
      ;;
    *)
      abort "unknown recovery action ${action}"
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  acquire_deploy_lock
  _recover_pending_switch
  release_deploy_lock
fi
