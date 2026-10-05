#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cup-survey}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.legacy.prod.yml}"
ROLLBACK_TAG="${ROLLBACK_TAG:-cup-survey-rollback:pre-bg}"

cd "$APP_DIR"

CONTAINER_ID="$(docker compose -f "$COMPOSE_FILE" ps -q app)"
if [[ -z "$CONTAINER_ID" ]]; then
  echo "FAIL: legacy app not running — pin pre-bg BEFORE stop legacy (Flow B step 11b)"
  exit 1
fi

RUNNING_IMAGE_ID="$(docker inspect "$CONTAINER_ID" --format '{{.Image}}')"
IMAGE_REF="$(docker inspect "$CONTAINER_ID" --format '{{.Config.Image}}')"

docker tag "$RUNNING_IMAGE_ID" "$ROLLBACK_TAG"
PRE_BG_DIGEST="$(docker inspect --format '{{.Id}}' "$ROLLBACK_TAG")"

echo "PRE_BG_DIGEST=$PRE_BG_DIGEST"
echo "PRE_BG_CONTAINER=$CONTAINER_ID"
echo "PRE_BG_IMAGE_REF=$IMAGE_REF"
echo "PRE_BG_ROLLBACK_TAG=$ROLLBACK_TAG"
docker image inspect "$ROLLBACK_TAG" --format 'digest={{.Id}} ref={{index .RepoTags 0}}'
