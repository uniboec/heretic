#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

TAG="${1:?release tag required}"
if command -v timeout >/dev/null 2>&1; then
  timeout "${MIGRATE_TIMEOUT_SEC}" "${SCRIPT_DIR}/run-migrate-with-runtime-env.sh" "${TAG}" migrate deploy
else
  "${SCRIPT_DIR}/run-migrate-with-runtime-env.sh" "${TAG}" migrate deploy
fi
