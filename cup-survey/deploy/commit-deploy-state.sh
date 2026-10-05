#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

ACTIVE_SLOT="${1:?active slot}"
ACTIVE_IMAGE="${2:?active image}"
ACTIVE_IMAGE_ID="${3:?active image id}"
PREVIOUS_IMAGE="${4:?previous image}"
PREVIOUS_IMAGE_ID="${5:?previous image id}"
NGINX_PORT="${6:?nginx port}"

PREVIOUS_NGINX_PORT=""
if [[ -f "${JOURNAL_FILE}" ]]; then
  PREVIOUS_NGINX_PORT="$("${PYTHON}" "${SCRIPT_DIR}/state_ops.py" journal-get "${JOURNAL_FILE}" previous_port)"
fi

export ACTIVE_SLOT ACTIVE_IMAGE ACTIVE_IMAGE_ID PREVIOUS_IMAGE PREVIOUS_IMAGE_ID NGINX_PORT
if ! "${PYTHON}" - <<'PY'
import os, sys
sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from state_ops import commit_state_after_switch, update_journal_phase
commit_state_after_switch(
    os.environ["DEPLOY_STATE_FILE"],
    active_slot=os.environ["ACTIVE_SLOT"],
    active_image=os.environ["ACTIVE_IMAGE"],
    active_image_id=os.environ["ACTIVE_IMAGE_ID"],
    previous_image=os.environ["PREVIOUS_IMAGE"],
    previous_image_id=os.environ["PREVIOUS_IMAGE_ID"],
    nginx_port=int(os.environ["NGINX_PORT"]),
)
update_journal_phase(os.environ["JOURNAL_FILE"], "STATE_COMMITTED")
PY
then
  if [[ -n "${PREVIOUS_NGINX_PORT}" ]]; then
    "${SCRIPT_DIR}/switch-upstream.sh" "${PREVIOUS_NGINX_PORT}" || true
  fi
  abort "commit-deploy-state failed; nginx restored to port ${PREVIOUS_NGINX_PORT}"
fi

echo "commit-deploy-state: OK"
