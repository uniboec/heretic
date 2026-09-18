#!/usr/bin/env bash
# Collision-safe additive merge of static assets from a built image.
# Usage: merge-static-assets.sh <IMAGE_REF> <IMAGE_ID> <METADATA_FILE>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
cup_survey_cd

if [[ $# -ne 3 ]]; then
  echo "usage: $0 <IMAGE_REF> <IMAGE_ID> <METADATA_FILE>" >&2
  exit 1
fi

IMAGE_REF="$1"
IMAGE_ID="$2"
METADATA_FILE="$3"

: "${IMAGE_REF:?}"
: "${IMAGE_ID:?}"
: "${METADATA_FILE:?}"

if [[ "${SHARED_STATIC_ROOT}" != /opt/cup-survey-shared/_next/static ]]; then
  echo "refusing: unexpected SHARED_STATIC_ROOT=${SHARED_STATIC_ROOT}" >&2
  exit 1
fi

if ! docker image inspect "${IMAGE_REF}" >/dev/null 2>&1; then
  echo "image not found: ${IMAGE_REF}" >&2
  exit 1
fi

ACTUAL_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "${IMAGE_REF}")"
if [[ "${ACTUAL_IMAGE_ID}" != "${IMAGE_ID}" ]]; then
  echo "image id mismatch: expected ${IMAGE_ID}, got ${ACTUAL_IMAGE_ID}" >&2
  exit 1
fi

TMP_DIR=""
EXTRACT_CID=""

cleanup() {
  local exit_code=$?
  if [[ -n "${EXTRACT_CID}" ]]; then
    docker rm -f "${EXTRACT_CID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${TMP_DIR}" && -d "${TMP_DIR}" ]]; then
    rm -rf "${TMP_DIR}"
  fi
  exit "${exit_code}"
}
trap cleanup EXIT INT TERM

TMP_DIR="$(mktemp -d)"
EXTRACT_CID="$(docker create "${IMAGE_REF}")"
docker cp "${EXTRACT_CID}:/app/.next/static/." "${TMP_DIR}/"
docker rm -f "${EXTRACT_CID}" >/dev/null
EXTRACT_CID=""

BUILD_ID="$(docker run --rm --entrypoint cat "${IMAGE_REF}" /app/.next/BUILD_ID)"
if [[ -z "${BUILD_ID}" ]]; then
  echo "failed to read BUILD_ID from image ${IMAGE_REF}" >&2
  exit 1
fi

mapfile -d '' SOURCE_FILES < <(find "${TMP_DIR}" -type f -print0 | sort -z)
if [[ "${#SOURCE_FILES[@]}" -eq 0 ]]; then
  echo "no static files found in image ${IMAGE_REF}" >&2
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

  if [[ ! -f "${dest}" ]]; then
    continue
  fi

  src_hash="$("${PYTHON}" -c "import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" "${src}")"
  dest_hash="$("${PYTHON}" -c "import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" "${dest}")"

  if [[ "${src_hash}" != "${dest_hash}" ]]; then
    echo "COLLISION: ${rel} existing_hash=${dest_hash} new_hash=${src_hash}" >&2
    CONFLICTS=$((CONFLICTS + 1))
  fi
done

if [[ "${CONFLICTS}" -gt 0 ]]; then
  echo "merge aborted: ${CONFLICTS} hash collision(s); no files copied" >&2
  exit 1
fi

for src in "${SOURCE_FILES[@]}"; do
  rel="${src#"${TMP_DIR}/"}"
  dest="${SHARED_STATIC_ROOT}/${rel}"
  mkdir -p "$(dirname "${dest}")"
  if [[ -f "${dest}" ]]; then
    continue
  fi
  cp -a "${src}" "${dest}"
done

for rel in "${REL_PATHS[@]}"; do
  if [[ ! -f "${SHARED_STATIC_ROOT}/${rel}" ]]; then
    echo "post-merge missing file: ${rel}" >&2
    exit 1
  fi
done

"${PYTHON}" "${SCRIPT_DIR}/write-merge-metadata.py" \
  "${METADATA_FILE}" \
  "${BUILD_ID}" \
  "${IMAGE_ID}" \
  "${IMAGE_REF}" \
  "${REL_PATHS[@]}"

echo "merge-static-assets: OK build_id=${BUILD_ID} files=${#REL_PATHS[@]}"
