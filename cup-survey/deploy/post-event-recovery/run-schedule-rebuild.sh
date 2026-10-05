#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cup-survey}"
DRY_RUN="${DRY_RUN:-1}"

cd "$APP_DIR"

if [[ "$DRY_RUN" == "1" ]]; then
  docker compose -f docker-compose.legacy.prod.yml run --rm --no-deps migrate \
    sh -c 'CUP_SURVEY_SCRIPT_MODE=1 npx tsx scripts/repair-schedule-legacy.ts --dry-run'
else
  docker compose -f docker-compose.legacy.prod.yml run --rm --no-deps migrate \
    sh -c 'CUP_SURVEY_SCRIPT_MODE=1 npx tsx scripts/repair-schedule-legacy.ts'
fi

echo "run-schedule-rebuild: OK"
