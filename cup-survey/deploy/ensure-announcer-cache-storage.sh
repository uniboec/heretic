#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${ANNOUNCER_CACHE_HOST_DIR:-/opt/cup-survey-data/announcer-cache}"

mkdir -p "$TARGET_DIR"
chmod 755 "$TARGET_DIR"
echo "Announcer cache directory ready: $TARGET_DIR"
