#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cup-survey}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.legacy.prod.yml}"
ROLLBACK_TAG="${ROLLBACK_TAG:-cup-survey-rollback:prod-pre-rc}"
PORT="${APP_PORT:-3001}"

cd "$APP_DIR"

CID="$(docker ps -qf "publish=${PORT}" | head -1)"
[[ -n "$CID" ]] || CID="$(docker compose -f "$COMPOSE_FILE" ps -q app | head -1)"
[[ -n "$CID" ]] || { echo "legacy app container not found"; exit 1; }

IMAGE_ID="$(docker inspect "$CID" --format '{{.Image}}')"
IMAGE_REF="$(docker inspect "$CID" --format '{{.Config.Image}}')"

docker tag "$IMAGE_ID" "$ROLLBACK_TAG"

echo "PIN_IMAGE_ID=$IMAGE_ID"
echo "PROD_PRE_RC_DIGEST=$IMAGE_ID"
echo "PIN_IMAGE_REF=$IMAGE_REF"
echo "PIN_ROLLBACK_TAG=$ROLLBACK_TAG"
docker image inspect "$ROLLBACK_TAG" --format 'digest={{.Id}} ref={{index .RepoTags 0}}'
