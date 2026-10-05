#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cup-survey}"
BASE_URL="${BASE_URL:-https://cup26.mma66.ru}"
COMPOSE_FILE="${COMPOSE_FILE:-${APP_DIR}/docker-compose.prod.yml}"
COMPOSE_IMAGES_ENV="${COMPOSE_IMAGES_ENV:-/opt/cup-survey-shared/compose-images.env}"
PRODUCTION_ENV_FILE="${PRODUCTION_ENV_FILE:-${APP_DIR}/.env}"

echo "=== monitor-prod $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
df -h / | tail -1
free -h | head -2
swapon --show 2>/dev/null || true

cd "$APP_DIR"
docker compose \
  --env-file "${PRODUCTION_ENV_FILE}" \
  --env-file "${COMPOSE_IMAGES_ENV}" \
  -f "${COMPOSE_FILE}" ps

curl -fsS "${BASE_URL}/api/health" | head -c 200
echo
curl -fsS "${BASE_URL}/api/tournament/results" | python3 -c "
import json,sys
d=json.load(sys.stdin)
s=d.get('stats') or {}
print('results', s.get('categoriesWithResults'), s.get('medalists'))
"
curl -fsS "${BASE_URL}/api/tournament/team-rankings" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('rankingStatus', d.get('rankingStatus'))
"

echo "monitor-prod: OK"
