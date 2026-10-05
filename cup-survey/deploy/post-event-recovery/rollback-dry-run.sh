#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cup-survey}"
ROLLBACK_MODE="${ROLLBACK_MODE:-BACKWARD_COMPATIBLE}"
DEPLOY_MODE="${DEPLOY_MODE:-BLUE_GREEN_COMPAT}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.legacy.prod.yml}"

cd "$APP_DIR"

echo "rollback-dry-run: ROLLBACK_MODE=$ROLLBACK_MODE DEPLOY_MODE=$DEPLOY_MODE"

echo "1) Strict freeze FIRST"
echo "2) Verify 3 GET routes return 503"
echo "3) compose preflight (CUP_DISABLE_LAZY_RECONCILE mapping)"
./deploy/post-event-recovery/compose-preflight.sh

case "$ROLLBACK_MODE" in
  DESTRUCTIVE)
    echo "4) DESTRUCTIVE: restore verified DB dump BEFORE app/nginx recreate"
    ;;
  BACKWARD_COMPAT|*)
    echo "4) BACKWARD_COMPAT: recreate app from pinned rollback image"
    ;;
esac

if [[ "$DEPLOY_MODE" == "MAINTENANCE_SCHEMA_CUTOVER" ]]; then
  echo "5) MAINTENANCE_SCHEMA_CUTOVER: stop legacy + workers before migrate"
else
  echo "5) BLUE_GREEN_COMPAT: legacy may remain running during migrate"
fi

echo "6) Protected runtime verify (digest + env=1) or remain Strict for prod-pre-rc"
echo "rollback-dry-run: OK (no changes applied)"
