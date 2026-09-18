#!/usr/bin/env bash
# Shared paths for cup-survey production deploy scripts.
APP_DIR="${APP_DIR:-/opt/cup-survey}"
COMPOSE_FILE="${APP_DIR}/docker-compose.prod.yml"
SHARED_STATIC_ROOT="${SHARED_STATIC_ROOT:-/opt/cup-survey-shared/_next/static}"
MANIFEST_PATH="${STATIC_DEPLOY_MANIFEST:-/opt/cup-survey-shared/static-deploy-manifest.json}"
STATE_DIR="${STATE_DIR:-/opt/cup-survey-shared}"
PYTHON="${PYTHON:-python3}"

cup_survey_cd() {
  cd "${APP_DIR}"
}
