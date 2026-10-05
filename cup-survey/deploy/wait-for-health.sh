#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

PORT="${1:?port required}"
MAX_ATTEMPTS="${2:-60}"
INTERVAL="${3:-2}"
HOST_HEADER="${PRODUCTION_HOST:-cup26.mma66.ru}"

for attempt in $(seq 1 "${MAX_ATTEMPTS}"); do
  if curl -fsS --max-time 5 \
    -H "Host: ${HOST_HEADER}" \
    -H "X-Forwarded-Proto: https" \
    "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    echo "wait-for-health: OK port=${PORT} attempt=${attempt}"
    exit 0
  fi
  sleep "${INTERVAL}"
done

echo "wait-for-health: timeout port=${PORT}" >&2
exit 1
