#!/usr/bin/env bash
# Automated subset of staging checklist from DEPLOY.md (run on staging VPS).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

FAILURES=0
pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*" >&2; FAILURES=$((FAILURES + 1)); }

echo "==> Unit tests"
python3 "${SCRIPT_DIR}/test_release_app_switch.py" || fail "test_release_app_switch"
python3 "${SCRIPT_DIR}/test_static_manifest.py" || fail "test_static_manifest"
python3 "${SCRIPT_DIR}/test_manifest_gate.py" || fail "test_manifest_gate"

echo "==> Script syntax"
if command -v bash >/dev/null 2>&1; then
  for sh in release-app.sh bootstrap-blue-green.sh deploy-lib.sh reconcile-deploy-state.sh; do
    bash -n "${SCRIPT_DIR}/${sh}" && pass "bash -n ${sh}" || fail "bash -n ${sh}"
  done
else
  echo "SKIP: bash not available"
fi

echo "==> State files"
[[ -f "${DEPLOY_STATE_FILE}" ]] && pass "deploy-state exists" || fail "deploy-state missing"
[[ -f "${MANIFEST_PATH}" ]] && pass "manifest exists" || fail "manifest missing"
[[ -f "${COMPOSE_IMAGES_ENV}" ]] && pass "compose-images.env exists" || fail "compose-images.env missing"

echo "==> Active slot"
SERVICE="$(active_app_service)"
CID="$(running_active_app_cid)"
[[ -n "${CID}" ]] && pass "running ${SERVICE}" || fail "no running ${SERVICE}"

echo "==> Health endpoints"
PORT="$(active_slot_name)"
PORT_NUM="$([[ "${PORT}" == green ]] && echo "${GREEN_PORT}" || echo "${BLUE_PORT}")"
if curl -fsS --max-time 10 -H "Host: ${PRODUCTION_HOST}" -H "X-Forwarded-Proto: https" \
  "http://127.0.0.1:${PORT_NUM}/api/health" | grep -q '"ok":true'; then
  pass "inactive-slot health :${PORT_NUM}"
else
  fail "health :${PORT_NUM}"
fi

if curl -fsS --max-time 15 "${PUBLIC_BASE_URL}/api/health" | grep -q '"ok":true'; then
  pass "public health"
else
  fail "public health"
fi

if curl -fsS --max-time 15 "${PUBLIC_BASE_URL}/api/build-info" | grep -q '"releaseId"'; then
  pass "public build-info"
else
  fail "public build-info"
fi

echo "==> Manifest gate"
if [[ -f "${DEPLOY_STATE_FILE}" ]]; then
  export DEPLOY_STATE_FILE MANIFEST_PATH
  export CLEANUP_STATUS="$("${PYTHON}" - <<'PY'
import json, os
with open(os.environ["DEPLOY_STATE_FILE"], encoding="utf-8") as handle:
    print(json.load(handle).get("cleanup_status", ""))
PY
)"
  "${PYTHON}" "${SCRIPT_DIR}/manifest_gate.py" && pass "manifest gate" || fail "manifest gate"
fi

echo "==> Deploy lock dry-run"
if [[ -f "${DEPLOY_LOCK_FILE}" ]]; then
  echo "SKIP: deploy lock file exists (deploy may be running)"
else
  pass "no deploy lock file"
fi

if [[ "${FAILURES}" -gt 0 ]]; then
  echo "staging-validation: ${FAILURES} failure(s)" >&2
  exit 1
fi
echo "staging-validation: ALL CHECKS PASSED"
