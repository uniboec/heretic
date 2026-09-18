#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
cup_survey_cd

RUNNING_CID="$(docker compose -f "${COMPOSE_FILE}" ps -q app 2>/dev/null | head -1)"
if [[ -z "${RUNNING_CID}" ]]; then
  echo "prevalidate aborted: no running app container" >&2
  exit 1
fi

RUNNING_IMAGE_ID="$(docker inspect "${RUNNING_CID}" --format '{{.Image}}')"

if ! docker image inspect cup-survey-app:current >/dev/null 2>&1; then
  echo "prevalidate aborted: cup-survey-app:current missing (run seed-current-image-tag.sh)" >&2
  exit 1
fi
CURRENT_TAG_IMAGE_ID="$(docker image inspect cup-survey-app:current --format '{{.Id}}')"

if [[ ! -f "${MANIFEST_PATH}" ]]; then
  echo "prevalidate aborted: manifest missing — run bootstrap first" >&2
  exit 1
fi

export MANIFEST_PATH RUNNING_IMAGE_ID CURRENT_TAG_IMAGE_ID
"${PYTHON}" - <<'PY'
import os
import sys

sys.path.insert(0, "/opt/cup-survey/deploy")
from static_manifest import get_current_deploy, load_manifest

manifest_path = os.environ["MANIFEST_PATH"]
running = os.environ["RUNNING_IMAGE_ID"]
current_tag = os.environ["CURRENT_TAG_IMAGE_ID"]

manifest = load_manifest(manifest_path)
current = get_current_deploy(manifest)
if current is None:
    sys.exit("manifest has no current deploy")

manifest_id = current["image_id"]
if manifest_id != current_tag or current_tag != running:
    sys.exit(
        "three-way identity mismatch:\n"
        f"  manifest={manifest_id}\n"
        f"  :current tag={current_tag}\n"
        f"  running={running}"
    )
print("prevalidate: three-way identity OK")
PY

echo "PREVIOUS_IMAGE_ID=${RUNNING_IMAGE_ID}"
echo "PREVIOUS_CONTAINER_ID=${RUNNING_CID}"
