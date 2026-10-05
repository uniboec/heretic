#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cup-survey}"
cd "$APP_DIR"

docker compose -f docker-compose.legacy.prod.yml run --rm --no-deps \
  -v "$APP_DIR/scripts:/app/scripts" \
  -v "$APP_DIR/lib:/app/lib" \
  migrate sh -c 'CUP_SURVEY_SCRIPT_MODE=1 npx tsx scripts/acceptance-b-probe-once.ts'
