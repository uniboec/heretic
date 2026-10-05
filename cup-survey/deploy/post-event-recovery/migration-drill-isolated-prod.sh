#!/usr/bin/env bash
# Isolated migration drill on prod host (does not touch live DB).
# Plan step 10b: restore dump → migrate → runtime smoke with release manifest images.
set -euo pipefail

RELEASE="${CUP_RELEASE_TAG:?set CUP_RELEASE_TAG}"
MANIFEST="${MANIFEST:-/tmp/cup-survey-release-manifest.json}"
DUMP_PATH="${DUMP_PATH:-}"
DRILL_PORT="${DRILL_PORT:-3099}"
DRILL_NET="${DRILL_NET:-cup-survey-drill-net}"
PG_CONTAINER="${PG_CONTAINER:-cup-survey-drill-postgres}"
APP_CONTAINER="${APP_CONTAINER:-cup-survey-drill-app}"

if [[ -z "$DUMP_PATH" ]]; then
  DUMP_PATH="$(ls -t /opt/cup-survey-backups/postgres/postgres-*.dump 2>/dev/null | head -1 || true)"
fi
[[ -n "$DUMP_PATH" && -f "$DUMP_PATH" ]] || { echo "FAIL: no dump for drill"; exit 1; }
[[ -f "$MANIFEST" ]] || { echo "FAIL: manifest missing: $MANIFEST"; exit 1; }

APP_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "cup-survey-app:${RELEASE}")"
MIGRATE_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "cup-survey-migrate:${RELEASE}")"
python3 - <<'PY' "$MANIFEST" "$APP_IMAGE_ID" "$MIGRATE_IMAGE_ID"
import json, sys
m = json.load(open(sys.argv[1], encoding="utf-8"))
assert m["app_image_id"] == sys.argv[2]
assert m["migrate_image_id"] == sys.argv[3]
print("manifest image IDs OK")
PY

echo "=== DRILL: restore $DUMP_PATH ==="
docker rm -f "${PG_CONTAINER}" "${APP_CONTAINER}" 2>/dev/null || true
docker network rm "${DRILL_NET}" 2>/dev/null || true
docker network create "${DRILL_NET}"

docker run -d --name "${PG_CONTAINER}" \
  --network "${DRILL_NET}" \
  -e POSTGRES_USER=cup_survey \
  -e POSTGRES_PASSWORD=drill \
  -e POSTGRES_DB=cup_survey \
  postgres:15-alpine
for i in $(seq 1 30); do
  docker exec "${PG_CONTAINER}" pg_isready -U cup_survey >/dev/null 2>&1 && break
  sleep 1
done

docker run --rm --network "${DRILL_NET}" \
  -e PGPASSWORD=drill \
  -v "${DUMP_PATH}:/dump:ro" \
  postgres:15-alpine \
  pg_restore --no-owner --no-acl -h "${PG_CONTAINER}" -U cup_survey -d cup_survey /dump || true

MIG_COUNT="$(docker run --rm --network "${DRILL_NET}" -e PGPASSWORD=drill postgres:15-alpine \
  psql -h "${PG_CONTAINER}" -U cup_survey -d cup_survey -tAc 'SELECT COUNT(*) FROM _prisma_migrations' 2>/dev/null || echo 0)"
echo "restored _prisma_migrations count: ${MIG_COUNT}"
[[ "${MIG_COUNT}" -ge 60 ]] || { echo "FAIL: pg_restore incomplete (expected >=60 migrations)"; exit 1; }

echo "=== DRILL: migrate ${RELEASE} ==="
docker run --rm --network "${DRILL_NET}" \
  -e "DATABASE_URL=postgresql://cup_survey:drill@${PG_CONTAINER}:5432/cup_survey?schema=public" \
  "cup-survey-migrate:${RELEASE}"

echo "=== DRILL: runtime smoke :${DRILL_PORT} ==="
docker rm -f "${APP_CONTAINER}" 2>/dev/null || true
docker run -d --name "${APP_CONTAINER}" \
  --network "${DRILL_NET}" \
  -e "DATABASE_URL=postgresql://cup_survey:drill@${PG_CONTAINER}:5432/cup_survey?schema=public" \
  -e CUP_DISABLE_LAZY_RECONCILE=1 \
  -p "${DRILL_PORT}:3000" \
  "cup-survey-app:${RELEASE}"

for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${DRILL_PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
curl -sf "http://127.0.0.1:${DRILL_PORT}/api/health"
curl -sf "http://127.0.0.1:${DRILL_PORT}/api/tournament/results" | python3 -c "
import json,sys
d=json.load(sys.stdin)
s=d.get('stats') or {}
print('drill results', s.get('categoriesWithResults'), s.get('medalists'))
"

docker rm -f "${PG_CONTAINER}" "${APP_CONTAINER}" 2>/dev/null || true
docker network rm "${DRILL_NET}" 2>/dev/null || true
echo "migration-drill-isolated-prod: OK"
