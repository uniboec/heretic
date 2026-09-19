#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
cup_survey_cd

: "${CUP_RELEASE_TAG:?CUP_RELEASE_TAG is required}"

ROLLBACK_NEEDED=1
CONTAINER_SWITCHED=0
PREVIOUS_IMAGE_ID=""
PREVIOUS_CONTAINER_ID=""
METADATA_FILE=""
ASSETS_FILE="${STATE_DIR}/deploy-assets.env"

rollback_deploy() {
  local rc=$?
  if [[ "${ROLLBACK_NEEDED}" -ne 1 ]]; then
    exit "${rc}"
  fi
  echo "ROLLBACK: deploy failed" >&2

  if [[ -n "${PREVIOUS_IMAGE_ID}" ]]; then
    docker tag "${PREVIOUS_IMAGE_ID}" cup-survey-app:current 2>/dev/null || true
  fi

  if [[ "${CONTAINER_SWITCHED}" -eq 1 ]]; then
    docker compose -f "${COMPOSE_FILE}" up -d --no-build --no-deps --force-recreate app 2>/dev/null || true
    sleep 10
    local rollback_cid
    rollback_cid="$(docker compose -f "${COMPOSE_FILE}" ps -q app)"
    local rollback_img
    rollback_img="$(docker inspect "${rollback_cid}" --format '{{.Image}}')"
    if [[ "${rollback_img}" != "${PREVIOUS_IMAGE_ID}" ]]; then
      echo "CRITICAL: rollback container image mismatch" >&2
      exit 1
    fi
    curl -fsS --max-time 20 http://127.0.0.1:3001/ >/dev/null || {
      echo "CRITICAL: rollback healthcheck failed" >&2
      exit 1
    }
  else
    echo "rollback: tag restored only (container not switched)" >&2
  fi

  rm -f "${METADATA_FILE}" 2>/dev/null || true
  exit "${rc}"
}
trap rollback_deploy ERR

PRE_HTML="$(curl -fsS --max-time 20 http://127.0.0.1:3001/ || true)"
PREV_CSS="$(printf '%s' "${PRE_HTML}" | grep -oE '/_next/static/chunks/[^"]+\.css' | head -1 || true)"
PREV_JS="$(printf '%s' "${PRE_HTML}" | grep -oE '/_next/static/chunks/[^"]+\.js' | head -1 || true)"

while IFS= read -r line; do
  case "${line}" in
    PREVIOUS_IMAGE_ID=*) PREVIOUS_IMAGE_ID="${line#PREVIOUS_IMAGE_ID=}" ;;
    PREVIOUS_CONTAINER_ID=*) PREVIOUS_CONTAINER_ID="${line#PREVIOUS_CONTAINER_ID=}" ;;
  esac
done < <(./deploy/prevalidate-production-state.sh)

BUILD_TAG="${CUP_RELEASE_TAG}"
docker compose -f "${COMPOSE_FILE}" build app

if docker image inspect cup-survey-app:current >/dev/null 2>&1; then
  docker tag cup-survey-app:current "cup-survey-app:${BUILD_TAG}"
else
  echo "release-app aborted: cup-survey-app:current missing after build" >&2
  exit 1
fi

IMAGE_REF="cup-survey-app:${BUILD_TAG}"
IMAGE_ID="$(docker image inspect --format '{{.Id}}' "${IMAGE_REF}")"

METADATA_FILE="$(mktemp /tmp/cup-survey-merge-meta.XXXXXX.json)"
./deploy/merge-static-assets.sh "${IMAGE_REF}" "${IMAGE_ID}" "${METADATA_FILE}"

docker tag "${IMAGE_ID}" cup-survey-app:current
# App-only switch: --no-deps avoids implicit migrate service (cup-survey-migrate image).
# Schema changes must be verified/applied in a separate explicit migration stage before release.
docker compose -f "${COMPOSE_FILE}" up -d --no-build --no-deps --force-recreate app
CONTAINER_SWITCHED=1

sleep 10
curl -fsS --max-time 20 http://127.0.0.1:3001/ >/dev/null

RUNNING_CID="$(docker compose -f "${COMPOSE_FILE}" ps -q app)"
RUNNING_IMAGE_ID="$(docker inspect "${RUNNING_CID}" --format '{{.Image}}')"
ID_CURRENT="$(docker image inspect cup-survey-app:current --format '{{.Id}}')"

if [[ "${IMAGE_ID}" != "${ID_CURRENT}" || "${ID_CURRENT}" != "${RUNNING_IMAGE_ID}" ]]; then
  echo "image identity verify failed" >&2
  echo "  BUILD=${IMAGE_ID}" >&2
  echo "  CURRENT=${ID_CURRENT}" >&2
  echo "  RUNNING=${RUNNING_IMAGE_ID}" >&2
  exit 1
fi

HTML="$(curl -fsS --max-time 20 http://127.0.0.1:3001/)"
NEW_CSS="$(printf '%s' "${HTML}" | grep -oE '/_next/static/chunks/[^"]+\.css' | head -1)"
NEW_JS="$(printf '%s' "${HTML}" | grep -oE '/_next/static/chunks/[^"]+\.js' | head -1)"
[[ -n "${PREV_CSS}" && -n "${PREV_JS}" && -n "${NEW_CSS}" && -n "${NEW_JS}" ]] || {
  echo "failed to capture CSS/JS URLs" >&2
  exit 1
}

./deploy/verify-public-static.sh "${PREV_CSS}" "${PREV_JS}" "${NEW_CSS}" "${NEW_JS}"

DEPLOY_ID="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export MANIFEST_PATH DEPLOY_ID METADATA_FILE
"${PYTHON}" - <<'PY'
import json
import os
import sys

sys.path.insert(0, "/opt/cup-survey/deploy")
from static_manifest import retire_and_promote_current_atomic

with open(os.environ["METADATA_FILE"], encoding="utf-8") as f:
    meta = json.load(f)

entry = {
    "deploy_id": os.environ["DEPLOY_ID"],
    "build_id": meta["build_id"],
    "image_id": meta["image_id"],
    "image_ref": meta["image_ref"],
    "deployed_at": os.environ["DEPLOY_ID"],
    "retired_at": None,
    "file_count": meta["file_count"],
    "files": meta["files"],
}
retire_and_promote_current_atomic(
    os.environ["MANIFEST_PATH"],
    entry,
    retired_at=os.environ["DEPLOY_ID"],
)
print("manifest promoted")
PY

ROLLBACK_NEEDED=0
trap - ERR

mkdir -p "${STATE_DIR}"
{
  echo "DEPLOY_ID=${DEPLOY_ID}"
  echo "IMAGE_REF=${IMAGE_REF}"
  echo "IMAGE_ID=${IMAGE_ID}"
  echo "PREV_CSS=${PREV_CSS}"
  echo "PREV_JS=${PREV_JS}"
  echo "CURRENT_CSS=${NEW_CSS}"
  echo "CURRENT_JS=${NEW_JS}"
} > "${ASSETS_FILE}"

rm -f "${METADATA_FILE}"
echo "release-app: OK image=${IMAGE_REF}"
