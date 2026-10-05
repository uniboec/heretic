#!/usr/bin/env bash
set -euo pipefail

MIN_FREE_RATIO="${MIN_FREE_RATIO:-0.20}"
DUMP_BYTES_ESTIMATE="${DUMP_BYTES_ESTIMATE:-0}"

df -h /
root_avail="$(df -B1 / | awk 'NR==2 {print $4}')"
root_pct="$(df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"

echo "disk_used_pct=$root_pct"
echo "disk_avail_bytes=$root_avail"

if [[ "$root_pct" -gt 80 ]]; then
  echo "WARN: disk usage above 80% — run cleanup before backup"
fi

if [[ "$DUMP_BYTES_ESTIMATE" -gt 0 ]]; then
  required=$((DUMP_BYTES_ESTIMATE * 2))
  if [[ "$root_avail" -lt "$required" ]]; then
    echo "FAIL: need at least 2x dump size free ($required bytes)"
    exit 1
  fi
fi

echo "disk-precheck: OK"
