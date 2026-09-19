#!/usr/bin/env bash
# Protect previous production image with immutable tag + stopped anchor container.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

fail_closed() {
  echo "release-image-retention: $*" >&2
  exit 1
}

ensure_immutable_tag() {
  local image_id="$1"
  local image_ref="$2"

  if docker image inspect "${image_ref}" >/dev/null 2>&1; then
    local tagged_id
    tagged_id="$(docker image inspect --format '{{.Id}}' "${image_ref}")"
    if [[ "${tagged_id}" != "${image_id}" ]]; then
      fail_closed "tag ${image_ref} points to ${tagged_id}, expected ${image_id}"
    fi
    echo "IMMUTABLE_TAG_OK=${image_ref}"
    return 0
  fi

  docker tag "${image_id}" "${image_ref}"
  tagged_id="$(docker image inspect --format '{{.Id}}' "${image_ref}")"
  if [[ "${tagged_id}" != "${image_id}" ]]; then
    fail_closed "failed to create tag ${image_ref} for ${image_id}"
  fi
  echo "IMMUTABLE_TAG_CREATED=${image_ref}"
}

ensure_anchor_container() {
  local image_id="$1"
  local image_ref="$2"
  local deploy_id="$3"
  local anchor_name
  anchor_name="$("${PYTHON}" "${SCRIPT_DIR}/image_retention.py" anchor-name "${deploy_id}")"

  if docker container inspect "${anchor_name}" >/dev/null 2>&1; then
    local anchor_image
    anchor_image="$(docker inspect --format '{{.Image}}' "${anchor_name}")"
    if [[ "${anchor_image}" != "${image_id}" ]]; then
      fail_closed "anchor ${anchor_name} references ${anchor_image}, expected ${image_id}"
    fi
    echo "ANCHOR_OK=${anchor_name}"
    return 0
  fi

  docker create \
    --name "${anchor_name}" \
    --restart=no \
    --entrypoint /bin/sh \
    "${image_ref}" \
    -c 'exit 0' >/dev/null

  anchor_image="$(docker inspect --format '{{.Image}}' "${anchor_name}")"
  if [[ "${anchor_image}" != "${image_id}" ]]; then
    fail_closed "anchor ${anchor_name} created with wrong image ${anchor_image}"
  fi
  echo "ANCHOR_CREATED=${anchor_name}"
}

ensure_new_release_tag() {
  local built_image_id="$1"
  local release_ref="$2"

  docker tag "${built_image_id}" "${release_ref}"
  local tagged_id
  tagged_id="$(docker image inspect --format '{{.Id}}' "${release_ref}")"
  if [[ "${tagged_id}" != "${built_image_id}" ]]; then
    fail_closed "release tag ${release_ref} points to ${tagged_id}, expected ${built_image_id}"
  fi
  echo "NEW_RELEASE_TAG_OK=${release_ref}"
}

ensure_previous_image_protected() {
  local previous_image_id="$1"

  if [[ -z "${previous_image_id}" ]]; then
    fail_closed "PREVIOUS_IMAGE_ID is empty"
  fi

  export MANIFEST_PATH DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
  local manifest_image_id manifest_image_ref manifest_deploy_id target_ref
  manifest_image_id="$("${PYTHON}" - <<'PY'
import os
import sys

sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from static_manifest import get_current_deploy, load_manifest

current = get_current_deploy(load_manifest(os.environ["MANIFEST_PATH"]))
print(current["image_id"])
PY
)"
  manifest_image_ref="$("${PYTHON}" - <<'PY'
import os
import sys

sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from static_manifest import get_current_deploy, load_manifest

current = get_current_deploy(load_manifest(os.environ["MANIFEST_PATH"]))
print(current["image_ref"])
PY
)"
  manifest_deploy_id="$("${PYTHON}" - <<'PY'
import os
import sys

sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from static_manifest import get_current_deploy, load_manifest

current = get_current_deploy(load_manifest(os.environ["MANIFEST_PATH"]))
print(current["deploy_id"])
PY
)"
  target_ref="$("${PYTHON}" "${SCRIPT_DIR}/image_retention.py" resolve-ref "${manifest_image_ref}" "${manifest_deploy_id}")"

  if [[ "${manifest_image_id}" != "${previous_image_id}" ]]; then
    fail_closed "manifest current image ${manifest_image_id} != previous ${previous_image_id}"
  fi

  ensure_immutable_tag "${previous_image_id}" "${target_ref}"
  ensure_anchor_container "${previous_image_id}" "${target_ref}" "${manifest_deploy_id}"

  echo "PREVIOUS_PROTECTED_REF=${target_ref}"
  echo "PREVIOUS_DEPLOY_ID=${manifest_deploy_id}"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  case "${1:-}" in
    ensure-previous)
      ensure_previous_image_protected "${2:?previous image id required}"
      ;;
    ensure-new-release-tag)
      ensure_new_release_tag "${2:?built image id}" "${3:?release ref}"
      ;;
    *)
      echo "usage: $0 ensure-previous <image_id> | ensure-new-release-tag <image_id> <release_ref>" >&2
      exit 2
      ;;
  esac
fi
