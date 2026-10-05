#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
cup_survey_cd

RUNNING_CID="$(running_active_app_cid)"
[[ -n "${RUNNING_CID}" ]] || { echo "seed aborted: no running active app"; exit 1; }

RUNNING_IMAGE_ID="$(docker inspect "${RUNNING_CID}" --format '{{.Image}}')"

if docker image inspect cup-survey-app:current >/dev/null 2>&1; then
  CURRENT_TAG_IMAGE_ID="$(docker image inspect cup-survey-app:current --format '{{.Id}}')"
  if [[ "${CURRENT_TAG_IMAGE_ID}" != "${RUNNING_IMAGE_ID}" ]]; then
    echo "seed aborted: cup-survey-app:current exists but differs from running" >&2
    echo "  :current=${CURRENT_TAG_IMAGE_ID}" >&2
    echo "  running=${RUNNING_IMAGE_ID}" >&2
    exit 1
  fi
  echo "seed skipped: cup-survey-app:current already matches running"
else
  docker tag "${RUNNING_IMAGE_ID}" cup-survey-app:current
  CURRENT_TAG_IMAGE_ID="${RUNNING_IMAGE_ID}"
  echo "seed OK: tagged running image as cup-survey-app:current"
fi

if [[ ! -f "${MANIFEST_PATH}" ]]; then
  echo "seed aborted: manifest missing (run bootstrap first)" >&2
  exit 1
fi

export MANIFEST_PATH RUNNING_IMAGE_ID CURRENT_TAG_IMAGE_ID DEPLOY_SCRIPT_DIR
"${PYTHON}" - <<'PY'
import os
import sys

sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from static_manifest import get_current_deploy, load_manifest

manifest = load_manifest(os.environ["MANIFEST_PATH"])
current = get_current_deploy(manifest)
if current is None:
    sys.exit("manifest has no current deploy")
running = os.environ["RUNNING_IMAGE_ID"]
current_tag = os.environ["CURRENT_TAG_IMAGE_ID"]
if current["image_id"] != running or running != current_tag:
    sys.exit(
        "three-way mismatch after seed:\n"
        f"  manifest={current['image_id']}\n"
        f"  running={running}\n"
        f"  :current={current_tag}"
    )
print("three-way identity OK after seed")
PY
