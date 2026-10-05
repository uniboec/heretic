#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

TEST_DB="cup_survey_restore_test"
BACKUP_FILE="${1:-}"
APP_TAG="${2:-}"

if [[ -z "${BACKUP_FILE}" ]]; then
  BACKUP_FILE="$("${SCRIPT_DIR}/backup-postgres.sh" | sed -n 's/^BACKUP_FILE=//p')"
fi
[[ -f "${BACKUP_FILE}" ]] || abort "backup file missing: ${BACKUP_FILE}"

"${SCRIPT_DIR}/write-compose-images-env.sh" 2>/dev/null || true

if [[ -z "${APP_TAG}" ]]; then
  APP_TAG="$(grep -E '^CUP_BLUE_IMAGE=|^CUP_GREEN_IMAGE=' "${COMPOSE_IMAGES_ENV}" | head -1 | cut -d= -f2 | cut -d: -f2)"
fi
[[ -n "${APP_TAG}" ]] || abort "cannot resolve app image tag for restore drill"

compose_prod exec -T postgres sh -ceu \
  "psql -U \"\$POSTGRES_USER\" -d postgres -c 'DROP DATABASE IF EXISTS ${TEST_DB};'"
compose_prod exec -T postgres sh -ceu \
  "psql -U \"\$POSTGRES_USER\" -d postgres -c 'CREATE DATABASE ${TEST_DB};'"
cat "${BACKUP_FILE}" | compose_prod exec -T postgres sh -ceu \
  "pg_restore -U \"\$POSTGRES_USER\" -d ${TEST_DB} --no-owner" || true
compose_prod exec -T postgres sh -ceu \
  "psql -U \"\$POSTGRES_USER\" -d ${TEST_DB} -c 'SELECT 1'" >/dev/null

MIGRATE_ENV="$(mktemp "${TMPDIR:-/tmp}/restore-drill-migrate.XXXXXX")"
cleanup() { rm -f "${MIGRATE_ENV}"; }
trap cleanup EXIT
umask 077
"${SCRIPT_DIR}/generate-migrate-runtime-env.sh" "${APP_TAG}" > "${MIGRATE_ENV}"
sed -i "s|/${POSTGRES_DB:-cup_survey}?|/${TEST_DB}?|g" "${MIGRATE_ENV}" 2>/dev/null \
  || sed -i '' "s|/${POSTGRES_DB:-cup_survey}?|/${TEST_DB}?|g" "${MIGRATE_ENV}"
chmod 600 "${MIGRATE_ENV}"

DRILL_PORT=3099
docker rm -f cup-survey-restore-drill >/dev/null 2>&1 || true
docker run -d --name cup-survey-restore-drill \
  --network "${DOCKER_NETWORK}" \
  --env-file "${MIGRATE_ENV}" \
  -e PAYMENT_PROOFS_DIR=/tmp/payment-proofs \
  -p "${DRILL_PORT}:3000" \
  "cup-survey-app:${APP_TAG}" >/dev/null

for _ in $(seq 1 30); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${DRILL_PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
curl -fsS --max-time 10 "http://127.0.0.1:${DRILL_PORT}/api/health" | grep -q '"ok":true' || abort "restore drill app health failed"

docker rm -f cup-survey-restore-drill >/dev/null 2>&1 || true
compose_prod exec -T postgres sh -ceu \
  "psql -U \"\$POSTGRES_USER\" -d postgres -c 'DROP DATABASE ${TEST_DB};'"

echo "restore-drill: OK ${BACKUP_FILE}"
