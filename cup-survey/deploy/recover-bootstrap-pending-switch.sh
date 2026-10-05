#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=deploy-lib.sh
source "${SCRIPT_DIR}/deploy-lib.sh"
# shellcheck source=finish-cleanup.sh
source "${SCRIPT_DIR}/finish-cleanup.sh"

_recover_bootstrap_pending_switch() {
  [[ -f "${JOURNAL_FILE}" ]] || {
    echo "RECOVERY_RESULT=RECOVERY_FAILED"
    return 1
  }

  if [[ -f "${DEPLOY_STATE_FILE}" ]] && [[ "$(journal_field_from_state traffic_status)" == "committed" ]]; then
    echo "RECOVERY_RESULT=COMMITTED_BLUE_GREEN"
    return 0
  fi

  local public_port previous_port target_port public_release target_release
  public_port="$("${PYTHON}" "${SCRIPT_DIR}/state_ops.py" read-upstream-port "${UPSTREAM_SNIPPET}")"
  previous_port="$(journal_field previous_port)"
  target_port="$(journal_field target_port)"
  public_release="$(get_public_release_id)"
  target_release="$(journal_field target_release_id)"

  if [[ "${public_port}" == "${previous_port}" ]]; then
    INACTIVE_SLOT="$(journal_field target_slot)"
    if rollback_traffic_to_previous; then
      close_pending_journal
      echo "RECOVERY_RESULT=ROLLED_BACK_TO_LEGACY"
      return 0
    fi
    echo "RECOVERY_RESULT=RECOVERY_FAILED"
    return 1
  fi

  if [[ "${public_port}" == "${target_port}" && "${public_release}" == "${target_release}" ]]; then
    restore_transaction_runtime_context
    if [[ "$(journal_field journal_phase)" == "VERIFIED" ]]; then
      "${SCRIPT_DIR}/observe-public.sh" "${CUP_RELEASE_TAG}" "${EXPECTED_GIT_SHA}" 3 5 || return 1
      "${PYTHON}" - <<'PY'
import os, sys
sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from state_ops import mark_traffic_committed
mark_traffic_committed(os.environ["DEPLOY_STATE_FILE"])
PY
      rm -f "${JOURNAL_FILE}"
      _finish_cleanup
      echo "RECOVERY_RESULT=COMMITTED_BLUE_GREEN"
      return 0
    fi
  fi

  restore_transaction_runtime_context
  echo "RECOVERY_RESULT=RESUME_STEP_N"
  return 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  acquire_deploy_lock
  _recover_bootstrap_pending_switch
  release_deploy_lock
fi
