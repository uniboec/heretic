#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://cup26.mma66.ru}"
MODE="${FREEZE_MODE:-strict}"

echo "verify-freeze: mode=$MODE base=$BASE_URL"

curl -sf "$BASE_URL/api/health" >/dev/null
echo "health: OK"

if [[ "$MODE" == "strict" ]]; then
  for route in /api/tournament/results /api/tournament/team-rankings /api/tournament/brackets; do
    headers="$(mktemp)"
    code="$(curl -s -D "$headers" -o /dev/null -w "%{http_code}" "$BASE_URL$route")"
    grep -qi 'cup-recovery' "$headers" || echo "WARN: missing X-Maintenance-Mode on $route"
    echo "$route => $code (expect 503)"
    [[ "$code" == "503" ]] || exit 1
    rm -f "$headers"
  done
elif [[ "$MODE" == "standard" ]]; then
  for route in /api/tournament/results /api/tournament/team-rankings /api/tournament/brackets; do
    curl -sf "$BASE_URL$route" >/dev/null
    echo "$route => 200 OK"
  done
else
  echo "unknown FREEZE_MODE=$MODE"
  exit 1
fi

echo "verify-freeze: OK"
