#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cup-survey}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.legacy.prod.yml}"
SERVICE="${SERVICE:-app}"
EXPECTED_IMAGE_ID="${EXPECTED_PROTECTED_IMAGE_ID:?set EXPECTED_PROTECTED_IMAGE_ID}"

cd "$APP_DIR"

CID="$(docker compose -f "$COMPOSE_FILE" ps -q "$SERVICE")"
[[ -n "$CID" ]] || { echo "container not running for $SERVICE"; exit 1; }

RUNNING_ID="$(docker inspect "$CID" --format '{{.Image}}')"
if [[ "$RUNNING_ID" != "$EXPECTED_IMAGE_ID" ]]; then
  echo "FAIL: image digest mismatch"
  echo "  running=$RUNNING_ID"
  echo "  expected=$EXPECTED_IMAGE_ID"
  exit 1
fi

docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" \
  printenv CUP_DISABLE_LAZY_RECONCILE | grep -qx '1' || {
  echo "FAIL: CUP_DISABLE_LAZY_RECONCILE is not 1 inside $SERVICE"
  exit 1
}

echo "verify-protected-runtime: OK ($SERVICE)"
