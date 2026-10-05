#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

if [[ "${CUP_SKIP_BUILD:-0}" == "1" ]]; then
  REQUIRED_MB="${NEW_APP_MB}"
else
  REQUIRED_MB=$((BUILD_PEAK_MB + NEW_APP_MB + BUFFER_MB))
fi
REQUIRED_DISK_KB=$((DISK_GATE_GB * 1024 * 1024))

if [[ -r /proc/meminfo ]]; then
  avail_kb="$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)"
  avail_mb=$((avail_kb / 1024))
  if [[ "${avail_mb}" -lt "${REQUIRED_MB}" ]]; then
    abort "MemAvailable ${avail_mb}MB < required ${REQUIRED_MB}MB"
  fi
  echo "MemAvailable OK: ${avail_mb}MB (need ${REQUIRED_MB}MB)"
fi

if command -v df >/dev/null 2>&1; then
  avail_kb="$(df -Pk / | awk 'NR==2 {print $4}')"
  if [[ -n "${avail_kb}" && "${avail_kb}" -lt "${REQUIRED_DISK_KB}" ]]; then
    abort "disk free ${avail_kb}KB < required ${REQUIRED_DISK_KB}KB (${DISK_GATE_GB}GB gate)"
  fi
  echo "disk OK: ${avail_kb}KB free (need ${DISK_GATE_GB}GB)"
fi

if [[ -r /proc/loadavg ]]; then
  load_1m="$(awk '{print $1}' /proc/loadavg)"
  cores="$(nproc 2>/dev/null || echo 1)"
  max_load="$(awk -v c="${cores}" -v f="${CPU_LOAD_FACTOR}" 'BEGIN { printf "%.2f", c * f }')"
  if awk -v load="${load_1m}" -v max="${max_load}" 'BEGIN { exit (load > max) ? 0 : 1 }'; then
    abort "load average ${load_1m} > ${max_load} (${cores} cores x ${CPU_LOAD_FACTOR})"
  fi
  echo "CPU load OK: ${load_1m} (max ${max_load})"
fi

if [[ -r /proc/meminfo ]]; then
  swap_used_kb="$(awk '/SwapTotal:|SwapFree:/ { if ($1=="SwapTotal:") t=$2; if ($1=="SwapFree:") f=$2 } END { print t-f }' /proc/meminfo)"
  swap_used_mb=$((swap_used_kb / 1024))
  if [[ "${swap_used_mb}" -gt "${SWAP_USED_MAX_MB}" ]]; then
    abort "swap used ${swap_used_mb}MB > max ${SWAP_USED_MAX_MB}MB"
  fi
  echo "swap OK: used ${swap_used_mb}MB"
fi

"${SCRIPT_DIR}/write-compose-images-env.sh" 2>/dev/null || true
if compose_prod exec -T postgres sh -ceu 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SHOW max_connections"' >/dev/null 2>&1; then
  max_conn="$(compose_prod exec -T postgres sh -ceu 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SHOW max_connections"' | tr -d '[:space:]')"
  active="$(compose_prod exec -T postgres sh -ceu 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM pg_stat_activity"' | tr -d '[:space:]')"
  headroom=$((max_conn - active))
  need=20
  if [[ "${headroom}" -lt "${need}" ]]; then
    abort "DB connection headroom ${headroom} < ${need}"
  fi
  echo "DB connections OK: headroom=${headroom}"
fi

echo "check-deploy-resources: OK"
