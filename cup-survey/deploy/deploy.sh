#!/usr/bin/env bash
# Local/dev entry point — production uses release-app.sh or bootstrap-blue-green.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
cup_survey_cd

if [[ ! -f .env ]]; then
  echo "Создайте .env из .env.production.example и заполните секреты."
  exit 1
fi

if [[ -f "${DEPLOY_STATE_FILE}" ]]; then
  echo "deploy.sh: blue-green state detected — running release-app.sh"
  exec "${SCRIPT_DIR}/release-app.sh"
fi

if docker ps --format '{{.Ports}}' 2>/dev/null | grep -q ":${BLUE_PORT}->"; then
  echo "deploy.sh: legacy app on :${BLUE_PORT} — run bootstrap-blue-green.sh for zero-downtime cutover"
  echo "  Or vps-setup.sh for fresh install after removing legacy container"
  exit 1
fi

echo "deploy.sh: fresh install via vps-setup.sh"
exec "${SCRIPT_DIR}/vps-setup.sh"
