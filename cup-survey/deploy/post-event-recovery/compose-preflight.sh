#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${APP_DIR:-/opt/cup-survey}"
cd "$APP_DIR"

legacy="$APP_DIR/docker-compose.legacy.prod.yml"
prod="$APP_DIR/docker-compose.prod.yml"

grep -q 'CUP_DISABLE_LAZY_RECONCILE' "$legacy" || {
  echo "FAIL: $legacy must map CUP_DISABLE_LAZY_RECONCILE into app environment"
  exit 1
}

grep -q 'CUP_DISABLE_LAZY_RECONCILE' "$prod" || {
  echo "FAIL: $prod must map CUP_DISABLE_LAZY_RECONCILE into app-blue and app-green"
  exit 1
}

echo "compose-preflight: OK"
