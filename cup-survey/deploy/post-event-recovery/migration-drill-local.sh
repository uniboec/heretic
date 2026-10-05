#!/usr/bin/env bash
set -euo pipefail

# Local migration/runtime drill (plan P0.5b / step 5).
# Requires: DUMP_PATH, ARTIFACT (images tarball), MANIFEST (release manifest JSON).

DUMP_PATH="${DUMP_PATH:?set DUMP_PATH to verified prod dump}"
ARTIFACT="${ARTIFACT:?set ARTIFACT to cup-survey-images.tar.gz}"
MANIFEST="${MANIFEST:-deploy-cup26-release-manifest.json}"
DRILL_PORT="${DRILL_PORT:-3011}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-cup-survey-drill}"

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CUP="$ROOT/cup-survey"

if [[ ! -f "$MANIFEST" ]]; then
  echo "FAIL: release manifest missing: $MANIFEST"
  exit 1
fi

if [[ -f "${ARTIFACT}.sha256" ]]; then
  sha256sum -c "${ARTIFACT}.sha256"
elif [[ -f "$MANIFEST" ]]; then
  python3 - <<'PY' "$MANIFEST" "$ARTIFACT"
import hashlib, json, sys
m = json.load(open(sys.argv[1], encoding="utf-8"))
h = hashlib.sha256()
with open(sys.argv[2], "rb") as f:
    for chunk in iter(lambda: f.read(1024 * 1024), b""):
        h.update(chunk)
if h.hexdigest() != m["artifact_sha256"]:
    raise SystemExit("artifact sha256 mismatch vs manifest")
print("artifact sha256 OK")
PY
fi

echo "=== LOAD IMAGES ==="
gunzip -c "$ARTIFACT" | docker load
APP_IMAGE_ID="$(docker image inspect --format '{{.Id}}' cup-survey-app:current)"
MIGRATE_IMAGE_ID="$(docker image inspect --format '{{.Id}}' cup-survey-migrate:current)"
python3 - <<'PY' "$MANIFEST" "$APP_IMAGE_ID" "$MIGRATE_IMAGE_ID"
import json, sys
m = json.load(open(sys.argv[1], encoding="utf-8"))
assert m["app_image_id"] == sys.argv[2], (m["app_image_id"], sys.argv[2])
assert m["migrate_image_id"] == sys.argv[3], (m["migrate_image_id"], sys.argv[3])
print("loaded image IDs match manifest")
PY

echo "=== RESTORE DUMP ==="
docker rm -f "${COMPOSE_PROJECT}-postgres" 2>/dev/null || true
docker volume rm "${COMPOSE_PROJECT}_pg" 2>/dev/null || true
docker run -d --name "${COMPOSE_PROJECT}-postgres" \
  -e POSTGRES_USER=cup_survey \
  -e POSTGRES_PASSWORD=drill \
  -e POSTGRES_DB=cup_survey \
  -p 55432:5432 \
  postgres:15-alpine
sleep 5
pg_restore --no-owner --no-acl -h 127.0.0.1 -p 55432 -U cup_survey -d cup_survey "$DUMP_PATH" || true

echo "=== MIGRATE (drill) ==="
docker run --rm \
  --network host \
  -e "DATABASE_URL=postgresql://cup_survey:drill@127.0.0.1:55432/cup_survey?schema=public" \
  cup-survey-migrate:current

echo "=== RUNTIME SMOKE ==="
docker rm -f "${COMPOSE_PROJECT}-app" 2>/dev/null || true
docker run -d --name "${COMPOSE_PROJECT}-app" \
  --network host \
  -e "DATABASE_URL=postgresql://cup_survey:drill@127.0.0.1:55432/cup_survey?schema=public" \
  -e CUP_DISABLE_LAZY_RECONCILE=1 \
  -p "${DRILL_PORT}:3000" \
  cup-survey-app:current
sleep 15
curl -sf "http://127.0.0.1:${DRILL_PORT}/api/health"
curl -sf "http://127.0.0.1:${DRILL_PORT}/api/tournament/results" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('stats'))"

echo "migration-drill-local: OK"
