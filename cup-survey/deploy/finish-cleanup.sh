#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=deploy-lib.sh
source "${SCRIPT_DIR}/deploy-lib.sh"

_finish_cleanup() {
  local active_slot inactive
  active_slot="$(journal_field_from_state active_slot 2>/dev/null || echo blue)"
  inactive="$(inactive_slot_for "${active_slot}")"
  compose_prod stop -t "${DRAIN_TIMEOUT}" "app-${inactive}" 2>/dev/null || true
  if [[ -n "${CUP_RELEASE_TAG:-}" ]]; then
    docker tag "cup-survey-app:${CUP_RELEASE_TAG}" cup-survey-app:current 2>/dev/null || true
  fi
  if [[ -f "${MANIFEST_PATH}" ]]; then
    export DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
    PRUNE_DRY_RUN=0 "${SCRIPT_DIR}/prune-static-assets.sh" 2>/dev/null || true
  fi
  "${PYTHON}" - <<'PY'
import os, sys
sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from state_ops import mark_cleanup_complete
mark_cleanup_complete(os.environ["DEPLOY_STATE_FILE"])
PY
  echo "finish-cleanup: OK"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  acquire_deploy_lock
  _finish_cleanup
  release_deploy_lock
fi
