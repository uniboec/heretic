#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
cup_survey_cd

ACTIVE_SLOT="blue"
if [[ -f "${DEPLOY_STATE_FILE}" ]]; then
  ACTIVE_SLOT="$("${PYTHON}" - <<'PY'
import json, os
with open(os.environ["DEPLOY_STATE_FILE"], encoding="utf-8") as f:
    print(json.load(f).get("active_slot", "blue"))
PY
)"
fi

SERVICE="app-${ACTIVE_SLOT}"
"${SCRIPT_DIR}/write-compose-images-env.sh" 2>/dev/null || true
RUNNING_CID="$(compose_prod ps -q "${SERVICE}" 2>/dev/null | head -1)"
if [[ -z "${RUNNING_CID}" ]]; then
  echo "prevalidate aborted: no running ${SERVICE} container" >&2
  exit 1
fi

RUNNING_IMAGE_ID="$(docker inspect "${RUNNING_CID}" --format '{{.Image}}')"

if [[ -f "${DEPLOY_STATE_FILE}" ]]; then
  STATE_IMAGE_ID="$("${PYTHON}" - <<'PY'
import json, os
with open(os.environ["DEPLOY_STATE_FILE"], encoding="utf-8") as f:
    print(json.load(f).get("active_image_id", ""))
PY
)"
  if [[ -n "${STATE_IMAGE_ID}" && "${STATE_IMAGE_ID}" != "${RUNNING_IMAGE_ID}" ]]; then
    echo "prevalidate aborted: state/running image mismatch" >&2
    exit 1
  fi
fi

if [[ ! -f "${MANIFEST_PATH}" ]]; then
  echo "prevalidate aborted: manifest missing — run bootstrap first" >&2
  exit 1
fi

export MANIFEST_PATH RUNNING_IMAGE_ID
"${PYTHON}" - <<'PY'
import os, sys
sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from static_manifest import get_current_deploy, load_manifest
manifest = load_manifest(os.environ["MANIFEST_PATH"])
current = get_current_deploy(manifest)
if current is None:
    sys.exit("manifest has no current deploy")
running = os.environ["RUNNING_IMAGE_ID"]
if current["image_id"] != running:
    sys.exit(f"manifest/running mismatch manifest={current['image_id']} running={running}")
print("prevalidate: identity OK")
PY

echo "PREVIOUS_IMAGE_ID=${RUNNING_IMAGE_ID}"
echo "PREVIOUS_CONTAINER_ID=${RUNNING_CID}"
