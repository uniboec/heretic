#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
cup_survey_cd

: "${GIT_SHA:?run ensure-clean-git.sh first}"

BUILD_CONTEXT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cup-survey-build-XXXXXX")"
cleanup_build_context() { rm -rf "${BUILD_CONTEXT_DIR}"; }
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  trap cleanup_build_context EXIT
fi

git archive --format=tar HEAD | tar -x -C "${BUILD_CONTEXT_DIR}"

export BUILD_CONTEXT_DIR
export CUP_RELEASE_TAG="release-$(date -u +%Y%m%dT%H%M%SZ)-${GIT_SHA:0:7}"

if docker image inspect "cup-survey-app:${CUP_RELEASE_TAG}" >/dev/null 2>&1; then
  abort "app tag already exists: ${CUP_RELEASE_TAG}"
fi
if docker image inspect "cup-survey-migrate:${CUP_RELEASE_TAG}" >/dev/null 2>&1; then
  abort "migrate tag already exists: ${CUP_RELEASE_TAG}"
fi

echo "BUILD_CONTEXT_DIR=${BUILD_CONTEXT_DIR}"
echo "CUP_RELEASE_TAG=${CUP_RELEASE_TAG}"
