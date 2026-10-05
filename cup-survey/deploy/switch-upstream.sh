#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

TARGET_PORT="${1:?target port required}"
BACKUP="${UPSTREAM_SNIPPET}.prev.backup"

cp "${UPSTREAM_SNIPPET}" "${BACKUP}"
"${PYTHON}" "${SCRIPT_DIR}/state_ops.py" write-upstream-snippet "${UPSTREAM_SNIPPET}" "${TARGET_PORT}"
if ! nginx -t; then
  cp "${BACKUP}" "${UPSTREAM_SNIPPET}"
  nginx -t
  nginx -s reload
  abort "nginx -t failed after upstream write; snippet restored"
fi
if ! nginx -s reload; then
  cp "${BACKUP}" "${UPSTREAM_SNIPPET}"
  nginx -t && nginx -s reload
  abort "nginx reload failed; snippet restored"
fi
echo "switch-upstream: OK port=${TARGET_PORT}"
