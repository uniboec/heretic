#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
cup_survey_cd

if git status --porcelain=v1 --untracked-files=all | grep -q .; then
  abort "working tree is not clean; commit or stash before deploy"
fi

export GIT_SHA
GIT_SHA="$(git rev-parse HEAD)"
echo "GIT_SHA=${GIT_SHA}"
