#!/usr/bin/env bash
# Slot helpers for blue-green deploy (sourced by deploy-lib.sh).

# shellcheck source=common.sh
source "${DEPLOY_SCRIPT_DIR}/common.sh"

slot_port() {
  case "$1" in
    blue) echo "${BLUE_PORT}" ;;
    green) echo "${GREEN_PORT}" ;;
    *) abort "unknown slot $1" ;;
  esac
}

inactive_slot_for() {
  if [[ "$1" == "blue" ]]; then
    echo green
  else
    echo blue
  fi
}

stop_inactive_slot() {
  [[ -n "${INACTIVE_SLOT:-}" ]] || abort "INACTIVE_SLOT not set"
  compose_prod stop -t "${DRAIN_TIMEOUT}" "app-${INACTIVE_SLOT}" 2>/dev/null || true
}

verify_inactive_slot_stopped() {
  [[ -n "${INACTIVE_SLOT:-}" ]] || abort "INACTIVE_SLOT not set"
  local cid running
  cid="$(compose_prod ps -q "app-${INACTIVE_SLOT}" 2>/dev/null | head -1 || true)"
  [[ -z "${cid}" ]] && return 0
  running="$(docker inspect --format '{{.State.Running}}' "${cid}" 2>/dev/null || echo false)"
  [[ "${running}" != "true" ]]
}

running_image_id_on_port() {
  local port="$1"
  local cid
  cid="$(docker ps --filter "publish=${port}" -q | head -1)"
  [[ -n "${cid}" ]] && docker inspect --format '{{.Image}}' "${cid}" || true
}
