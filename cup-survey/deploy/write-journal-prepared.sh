#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

export TARGET_IMAGE_REF TARGET_IMAGE_ID TARGET_RELEASE_ID TARGET_GIT_SHA
export PREVIOUS_PORT TARGET_PORT PREVIOUS_SLOT TARGET_SLOT
export PREVIOUS_IMAGE PREVIOUS_IMAGE_ID PREVIOUS_STATE_EXISTED

"${PYTHON}" - <<'PY'
import json
import os
import sys

sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from state_ops import load, write_journal_prepared

snapshot = None
if os.environ.get("PREVIOUS_STATE_EXISTED", "true") == "true" and os.path.isfile(os.environ["DEPLOY_STATE_FILE"]):
    snapshot = load(os.environ["DEPLOY_STATE_FILE"])

legacy = None
if os.environ.get("LEGACY_PREVIOUS_IDENTITY_JSON"):
    legacy = json.loads(os.environ["LEGACY_PREVIOUS_IDENTITY_JSON"])

write_journal_prepared(
    os.environ["JOURNAL_FILE"],
    target_image_ref=os.environ["TARGET_IMAGE_REF"],
    target_image_id=os.environ["TARGET_IMAGE_ID"],
    target_release_id=os.environ["TARGET_RELEASE_ID"],
    target_git_sha=os.environ["TARGET_GIT_SHA"],
    previous_port=int(os.environ["PREVIOUS_PORT"]),
    target_port=int(os.environ["TARGET_PORT"]),
    previous_slot=os.environ["PREVIOUS_SLOT"],
    target_slot=os.environ["TARGET_SLOT"],
    previous_image=os.environ["PREVIOUS_IMAGE"],
    previous_image_id=os.environ["PREVIOUS_IMAGE_ID"],
    previous_state_existed=os.environ.get("PREVIOUS_STATE_EXISTED", "true") == "true",
    snapshot=snapshot,
    legacy_previous_identity=legacy,
    rollback_intent=os.environ.get("ROLLBACK_INTENT", "false") == "true",
)
PY

echo "write-journal-prepared: OK"
