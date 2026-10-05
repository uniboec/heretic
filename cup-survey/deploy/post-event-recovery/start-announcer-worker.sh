#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cup-survey}"
COMPOSE_FILE="${COMPOSE_FILE:-${APP_DIR}/docker-compose.prod.yml}"
COMPOSE_IMAGES_ENV="${COMPOSE_IMAGES_ENV:-/opt/cup-survey-shared/compose-images.env}"
PRODUCTION_ENV_FILE="${PRODUCTION_ENV_FILE:-${APP_DIR}/.env}"

cd "$APP_DIR"
"${APP_DIR}/deploy/ensure-announcer-cache-storage.sh"

APP_DIR="$APP_DIR" DEPLOY_SCRIPT_DIR="${APP_DIR}/deploy" \
  COMPOSE_FILE="$COMPOSE_FILE" PRODUCTION_ENV_FILE="$PRODUCTION_ENV_FILE" \
  COMPOSE_IMAGES_ENV="$COMPOSE_IMAGES_ENV" \
  STATE_DIR="/opt/cup-survey-shared" \
  DEPLOY_STATE_FILE="${DEPLOY_STATE_FILE:-/opt/cup-survey-shared/deploy-state.json}" \
  "${APP_DIR}/deploy/write-compose-images-env.sh"

DEPLOY_STATE_FILE="${DEPLOY_STATE_FILE:-/opt/cup-survey-shared/deploy-state.json}"
export DEPLOY_STATE_FILE
ACTIVE_IMAGE="$(python3 - <<'PY'
import json, os
with open(os.environ["DEPLOY_STATE_FILE"], encoding="utf-8") as handle:
    print(json.load(handle)["active_image"])
PY
)"
export CUP_BLUE_IMAGE="${ACTIVE_IMAGE}"

docker compose \
  --env-file "${PRODUCTION_ENV_FILE}" \
  --env-file "${COMPOSE_IMAGES_ENV}" \
  -f "${COMPOSE_FILE}" up -d --no-build announcer-worker

docker compose \
  --env-file "${PRODUCTION_ENV_FILE}" \
  --env-file "${COMPOSE_IMAGES_ENV}" \
  -f "${COMPOSE_FILE}" ps announcer-worker

echo "start-announcer-worker: OK"
