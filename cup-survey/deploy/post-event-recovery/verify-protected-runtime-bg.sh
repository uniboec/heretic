#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=../deploy-lib.sh
source "${SCRIPT_DIR}/deploy-lib.sh"

ACTIVE_IMAGE_ID="${APP_IMAGE_ID:?set APP_IMAGE_ID from release manifest}"

cup_survey_cd
"${SCRIPT_DIR}/write-compose-images-env.sh"

ACTIVE_SLOT="$(active_slot_name)"
INACTIVE_SLOT="$(inactive_slot_for "${ACTIVE_SLOT}")"
PREVIOUS_IMAGE_ID="$(journal_field_from_state previous_image_id 2>/dev/null || true)"

declare -A EXPECTED_BY_SVC=(
  ["app-${ACTIVE_SLOT}"]="${ACTIVE_IMAGE_ID}"
  ["app-${INACTIVE_SLOT}"]="${PREVIOUS_IMAGE_ID:-${ACTIVE_IMAGE_ID}}"
)

for svc in "app-${ACTIVE_SLOT}" "app-${INACTIVE_SLOT}"; do
  CID="$(compose_prod ps -q "$svc" | head -1 || true)"
  if [[ -z "$CID" ]]; then
    compose_prod up -d --no-build --no-deps "$svc"
    CID="$(compose_prod ps -q "$svc" | head -1 || true)"
  fi
  [[ -n "$CID" ]] || { echo "container not running for $svc"; exit 1; }
  RUNNING_ID="$(docker inspect "$CID" --format '{{.Image}}')"
  EXPECTED_ID="${EXPECTED_BY_SVC[$svc]}"
  if [[ "$RUNNING_ID" != "$EXPECTED_ID" ]]; then
    echo "FAIL: $svc image digest mismatch"
    echo "  running=$RUNNING_ID"
    echo "  expected=$EXPECTED_ID"
    exit 1
  fi
  compose_prod exec -T "$svc" \
    printenv CUP_DISABLE_LAZY_RECONCILE | grep -qx '1' || {
    echo "FAIL: CUP_DISABLE_LAZY_RECONCILE is not 1 inside $svc"
    exit 1
  }
  echo "verify-protected-runtime-bg: OK ($svc)"
done
