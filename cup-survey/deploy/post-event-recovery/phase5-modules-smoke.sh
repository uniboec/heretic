#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://cup26.mma66.ru}"
APP_DIR="${APP_DIR:-/opt/cup-survey}"
COMPOSE_FILE="${COMPOSE_FILE:-${APP_DIR}/docker-compose.prod.yml}"
COMPOSE_IMAGES_ENV="${COMPOSE_IMAGES_ENV:-/opt/cup-survey-shared/compose-images.env}"
PRODUCTION_ENV_FILE="${PRODUCTION_ENV_FILE:-${APP_DIR}/.env}"

echo "phase5-modules-smoke: start"

code="$(curl -s -o /tmp/cup-phase5-awards.json -w "%{http_code}" "${BASE_URL}/api/tournament/awards")"
if [[ "$code" == "200" ]]; then
  python3 -c "import json; d=json.load(open('/tmp/cup-phase5-awards.json')); assert any(k in d for k in ('queue','completed','categories','rows','placements'))"
  echo "public awards: OK (200)"
elif [[ "$code" == "404" ]]; then
  echo "public awards: OK (404 disabled)"
else
  echo "FAIL: public awards HTTP $code"
  exit 1
fi

code="$(curl -s -o /tmp/cup-phase5-fastest.json -w "%{http_code}" "${BASE_URL}/api/tournament/fastest-fights")"
if [[ "$code" == "200" ]]; then
  python3 -c "import json; d=json.load(open('/tmp/cup-phase5-fastest.json')); assert isinstance(d, dict)"
  echo "fastest-fights: OK (200)"
elif [[ "$code" == "404" ]]; then
  echo "fastest-fights: OK (404 not configured)"
else
  echo "FAIL: fastest-fights HTTP $code"
  exit 1
fi

for route in /api/admin/awards /api/admin/mandate-commission; do
  code="$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${route}")"
  if [[ "$code" != "401" && "$code" != "403" ]]; then
    echo "FAIL: ${route} expected 401/403, got ${code}"
    exit 1
  fi
  echo "admin route ${route}: OK (${code})"
done

cd "$APP_DIR"
status="$(docker compose \
  --env-file "${PRODUCTION_ENV_FILE}" \
  --env-file "${COMPOSE_IMAGES_ENV}" \
  -f "${COMPOSE_FILE}" ps announcer-worker --format '{{.Status}}' 2>/dev/null | head -1 || true)"
if [[ "$status" != *healthy* ]]; then
  echo "FAIL: announcer-worker not healthy: ${status:-missing}"
  exit 1
fi
echo "announcer-worker: OK (${status})"

echo "phase5-modules-smoke: OK"
