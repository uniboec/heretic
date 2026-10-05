#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

TAG="${1:?release tag required}"

OUTPUT="$("${SCRIPT_DIR}/run-migrate-with-runtime-env.sh" "${TAG}" migrate status 2>&1)" || true

if echo "${OUTPUT}" | grep -qi "following migration.*not yet been applied\|have not yet been applied"; then
  echo "PENDING"
  exit 0
fi
if echo "${OUTPUT}" | grep -qi "database schema is up to date"; then
  echo "UP_TO_DATE"
  exit 0
fi
echo "BROKEN"
echo "${OUTPUT}" >&2
exit 1
