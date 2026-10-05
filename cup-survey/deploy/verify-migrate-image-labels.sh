#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

TAG="${1:?release tag required}"
APP_IMAGE="cup-survey-app:${TAG}"
MIGRATE_IMAGE="cup-survey-migrate:${TAG}"

docker image inspect "${APP_IMAGE}" >/dev/null || abort "app image missing: ${APP_IMAGE}"
docker image inspect "${MIGRATE_IMAGE}" >/dev/null || abort "migrate image missing: ${MIGRATE_IMAGE}"

read_labels() {
  docker image inspect --format '{{index .Config.Labels "cup.release_id"}} {{index .Config.Labels "cup.git_sha"}}' "$1"
}

read -r app_release app_sha <<<"$(read_labels "${APP_IMAGE}")"
read -r mig_release mig_sha <<<"$(read_labels "${MIGRATE_IMAGE}")"

[[ -n "${app_release}" && -n "${app_sha}" ]] || abort "missing OCI labels on ${APP_IMAGE}"
[[ -n "${mig_release}" && -n "${mig_sha}" ]] || abort "missing OCI labels on ${MIGRATE_IMAGE}"
[[ "${app_release}" == "${mig_release}" ]] || abort "release_id mismatch app=${app_release} migrate=${mig_release}"
[[ "${app_sha}" == "${mig_sha}" ]] || abort "git_sha mismatch app=${app_sha} migrate=${mig_sha}"

echo "verify-migrate-image-labels: OK ${TAG}"
