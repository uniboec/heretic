#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

CUP_RELEASE_TAG="${1:?release tag required}"
shift

MIGRATE_RUNTIME_ENV="$(mktemp "${TMPDIR:-/tmp}/migrate-runtime.XXXXXX")"
cleanup_migrate_env() { rm -f "${MIGRATE_RUNTIME_ENV}"; }
trap cleanup_migrate_env EXIT
trap 'cleanup_migrate_env; exit 130' INT
trap 'cleanup_migrate_env; exit 143' TERM

umask 077
"${SCRIPT_DIR}/generate-migrate-runtime-env.sh" "${CUP_RELEASE_TAG}" > "${MIGRATE_RUNTIME_ENV}"
chmod 600 "${MIGRATE_RUNTIME_ENV}"

docker run --rm --network "${DOCKER_NETWORK}" \
  --env-file "${MIGRATE_RUNTIME_ENV}" \
  "cup-survey-migrate:${CUP_RELEASE_TAG}" \
  npx prisma "$@"
