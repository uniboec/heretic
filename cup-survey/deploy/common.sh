#!/usr/bin/env bash
# Shared paths and helpers for cup-survey production deploy scripts.

APP_DIR="${APP_DIR:-/opt/cup-survey}"
COMPOSE_FILE="${APP_DIR}/docker-compose.prod.yml"
PRODUCTION_ENV_FILE="${PRODUCTION_ENV_FILE:-${APP_DIR}/.env}"
COMPOSE_IMAGES_ENV="${COMPOSE_IMAGES_ENV:-/opt/cup-survey-shared/compose-images.env}"
SHARED_STATIC_ROOT="${SHARED_STATIC_ROOT:-/opt/cup-survey-shared/_next/static}"
MANIFEST_PATH="${STATIC_DEPLOY_MANIFEST:-/opt/cup-survey-shared/static-deploy-manifest.json}"
STATE_DIR="${STATE_DIR:-/opt/cup-survey-shared}"
DEPLOY_STATE_FILE="${DEPLOY_STATE_FILE:-${STATE_DIR}/deploy-state.json}"
JOURNAL_FILE="${JOURNAL_FILE:-${STATE_DIR}/pending-switch.json}"
DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-${STATE_DIR}/deploy.lock}"
DOCKER_NETWORK="${DOCKER_NETWORK:-cup-survey-prod}"
UPSTREAM_SNIPPET="${UPSTREAM_SNIPPET:-/etc/nginx/snippets/cup-survey-upstream.conf}"
PRODUCTION_HOST="${PRODUCTION_HOST:-cup26.mma66.ru}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://cup26.mma66.ru}"
BLUE_PORT="${BLUE_PORT:-3001}"
GREEN_PORT="${GREEN_PORT:-3002}"
PAYMENT_PROOFS_HOST_DIR="${PAYMENT_PROOFS_HOST_DIR:-/opt/cup-survey-data/payment-proofs}"
PAYMENT_PROOFS_BACKUP_DIR="${PAYMENT_PROOFS_BACKUP_DIR:-/opt/cup-survey-backups/payment-proofs}"
PAYMENT_PROOFS_CONTAINER_DIR="/app/data/payment-proofs"
PAYMENT_PROOFS_APP_UID="${PAYMENT_PROOFS_APP_UID:-1001}"
POSTGRES_BACKUP_DIR="${POSTGRES_BACKUP_DIR:-/opt/cup-survey-backups/postgres}"
DRAIN_TIMEOUT="${DRAIN_TIMEOUT:-130}"
DISK_GATE_GB="${DISK_GATE_GB:-8}"
BUILD_PEAK_MB="${BUILD_PEAK_MB:-2048}"
NEW_APP_MB="${NEW_APP_MB:-512}"
BUFFER_MB="${BUFFER_MB:-512}"
CPU_LOAD_FACTOR="${CPU_LOAD_FACTOR:-2}"
SWAP_USED_MAX_MB="${SWAP_USED_MAX_MB:-512}"
MIGRATE_TIMEOUT_SEC="${MIGRATE_TIMEOUT_SEC:-300}"
PYTHON="${PYTHON:-python3}"
DEPLOY_SCRIPT_DIR="${DEPLOY_SCRIPT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

cup_survey_cd() {
  cd "${APP_DIR}"
}

compose_prod() {
  docker compose \
    --env-file "${PRODUCTION_ENV_FILE}" \
    --env-file "${COMPOSE_IMAGES_ENV}" \
    -f "${COMPOSE_FILE}" "$@"
}

abort() {
  echo "ABORT: $*" >&2
  exit 1
}

active_slot_name() {
  if [[ -f "${DEPLOY_STATE_FILE}" ]]; then
    export DEPLOY_STATE_FILE
    "${PYTHON}" - <<'PY'
import json, os
with open(os.environ["DEPLOY_STATE_FILE"], encoding="utf-8") as handle:
    print(json.load(handle).get("active_slot", "blue"))
PY
    return 0
  fi
  local port=""
  if [[ -f "${UPSTREAM_SNIPPET}" ]]; then
    port="$("${PYTHON}" "${DEPLOY_SCRIPT_DIR}/state_ops.py" read-upstream-port "${UPSTREAM_SNIPPET}" 2>/dev/null || true)"
  fi
  if [[ "${port}" == "${GREEN_PORT}" ]]; then
    echo green
  else
    echo blue
  fi
}

active_app_service() {
  echo "app-$(active_slot_name)"
}

ensure_compose_images_env() {
  if [[ ! -f "${COMPOSE_IMAGES_ENV}" ]]; then
    "${DEPLOY_SCRIPT_DIR}/write-compose-images-env.sh" 2>/dev/null || true
  fi
}

running_active_app_cid() {
  ensure_compose_images_env
  local cid service
  service="$(active_app_service)"
  cid="$(compose_prod ps -q "${service}" 2>/dev/null | head -1 || true)"
  if [[ -n "${cid}" ]]; then
    echo "${cid}"
    return 0
  fi
  cid="$(docker ps -qf "publish=${BLUE_PORT}" | head -1 || true)"
  if [[ -n "${cid}" ]]; then
    echo "${cid}"
    return 0
  fi
  docker ps -qf "publish=${GREEN_PORT}" | head -1 || true
}
