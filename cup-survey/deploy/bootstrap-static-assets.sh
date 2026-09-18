#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
cup_survey_cd

FREE_PCT="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print 100-$5}')"
if awk "BEGIN {exit !(${FREE_PCT} < 15)}"; then
  echo "bootstrap aborted: free disk ${FREE_PCT}% < 15%" >&2
  exit 1
fi

RUNNING_CID="$(docker compose -f "${COMPOSE_FILE}" ps -q app | head -1)"
if [[ -z "${RUNNING_CID}" ]]; then
  echo "bootstrap aborted: no running cup-survey-app container" >&2
  exit 1
fi

IMAGE_REF="$(docker inspect "${RUNNING_CID}" --format '{{.Config.Image}}')"
IMAGE_ID="$(docker inspect "${RUNNING_CID}" --format '{{.Image}}')"

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
DEPLOY_ID="bootstrap-${NOW}"
DEPLOYED_AT="${NOW}"

TMP_DIR=""
cleanup() {
  local exit_code=$?
  [[ -n "${TMP_DIR}" && -d "${TMP_DIR}" ]] && rm -rf "${TMP_DIR}"
  exit "${exit_code}"
}
trap cleanup EXIT INT TERM

TMP_DIR="$(mktemp -d)"
docker cp "${RUNNING_CID}:/app/.next/static/." "${TMP_DIR}/"
BUILD_ID="$(docker exec "${RUNNING_CID}" cat /app/.next/BUILD_ID)"

mapfile -d '' SOURCE_FILES < <(find "${TMP_DIR}" -type f -print0 | sort -z)
if [[ "${#SOURCE_FILES[@]}" -eq 0 ]]; then
  echo "bootstrap aborted: no static files in running container" >&2
  exit 1
fi

REL_PATHS=()
for src in "${SOURCE_FILES[@]}"; do
  REL_PATHS+=("${src#"${TMP_DIR}/"}")
done

mkdir -p "${SHARED_STATIC_ROOT}"

CONFLICTS=0
for src in "${SOURCE_FILES[@]}"; do
  rel="${src#"${TMP_DIR}/"}"
  dest="${SHARED_STATIC_ROOT}/${rel}"
  [[ -f "${dest}" ]] || continue
  src_hash="$("${PYTHON}" -c "import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" "${src}")"
  dest_hash="$("${PYTHON}" -c "import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" "${dest}")"
  if [[ "${src_hash}" != "${dest_hash}" ]]; then
    echo "bootstrap collision: ${rel}" >&2
    CONFLICTS=$((CONFLICTS + 1))
  fi
done
if [[ "${CONFLICTS}" -gt 0 ]]; then
  echo "bootstrap aborted: hash collisions" >&2
  exit 1
fi

for src in "${SOURCE_FILES[@]}"; do
  rel="${src#"${TMP_DIR}/"}"
  dest="${SHARED_STATIC_ROOT}/${rel}"
  mkdir -p "$(dirname "${dest}")"
  [[ -f "${dest}" ]] || cp -a "${src}" "${dest}"
done

for rel in "${REL_PATHS[@]}"; do
  [[ -f "${SHARED_STATIC_ROOT}/${rel}" ]] || { echo "missing after copy: ${rel}" >&2; exit 1; }
done

export MANIFEST_PATH DEPLOY_ID DEPLOYED_AT BUILD_ID IMAGE_ID IMAGE_REF
export FILE_COUNT="${#REL_PATHS[@]}"
FILES_JSON="$("${PYTHON}" -c "import json,sys; print(json.dumps(sys.argv[1:]))" "${REL_PATHS[@]}")"
export FILES_JSON

"${PYTHON}" - <<'PY'
import json
import os
import sys

sys.path.insert(0, "/opt/cup-survey/deploy")
from static_manifest import (
    ManifestCorruptError,
    ManifestMissingError,
    add_initial_deploy_atomic,
    load_manifest,
)

manifest_path = os.environ["MANIFEST_PATH"]
image_id = os.environ["IMAGE_ID"]

try:
    manifest = load_manifest(manifest_path)
except ManifestMissingError:
    entry = {
        "deploy_id": os.environ["DEPLOY_ID"],
        "build_id": os.environ["BUILD_ID"],
        "image_id": image_id,
        "image_ref": os.environ["IMAGE_REF"],
        "deployed_at": os.environ["DEPLOYED_AT"],
        "retired_at": None,
        "file_count": int(os.environ["FILE_COUNT"]),
        "files": json.loads(os.environ["FILES_JSON"]),
    }
    add_initial_deploy_atomic(manifest_path, entry)
    print("bootstrap manifest created")
    sys.exit(0)
except ManifestCorruptError as exc:
    print(f"bootstrap aborted: corrupt manifest: {exc}", file=sys.stderr)
    sys.exit(1)

for deploy in manifest["deploys"]:
    if deploy["image_id"] == image_id:
        print("bootstrap skipped: current image already in manifest")
        sys.exit(0)

print("bootstrap aborted: manifest exists but current image not present", file=sys.stderr)
sys.exit(1)
PY

echo "bootstrap-static-assets: OK deploy_id=${DEPLOY_ID} files=${#REL_PATHS[@]}"
