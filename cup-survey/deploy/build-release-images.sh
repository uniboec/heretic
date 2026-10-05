#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

: "${BUILD_CONTEXT_DIR:?}"
: "${CUP_RELEASE_TAG:?}"
: "${GIT_SHA:?}"

export DOCKER_BUILDKIT=1

docker build \
  --build-arg RELEASE_ID="${CUP_RELEASE_TAG}" \
  --build-arg GIT_SHA="${GIT_SHA}" \
  -t "cup-survey-app:${CUP_RELEASE_TAG}" \
  -f "${BUILD_CONTEXT_DIR}/Dockerfile" "${BUILD_CONTEXT_DIR}"

docker build \
  --target migrate \
  --build-arg RELEASE_ID="${CUP_RELEASE_TAG}" \
  --build-arg GIT_SHA="${GIT_SHA}" \
  -t "cup-survey-migrate:${CUP_RELEASE_TAG}" \
  -f "${BUILD_CONTEXT_DIR}/Dockerfile" "${BUILD_CONTEXT_DIR}"

CANDIDATE_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "cup-survey-app:${CUP_RELEASE_TAG}")"
echo "CANDIDATE_IMAGE_ID=${CANDIDATE_IMAGE_ID}"
