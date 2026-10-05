#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=deploy-lib.sh
source "${SCRIPT_DIR}/deploy-lib.sh"

acquire_deploy_lock
cup_survey_cd

[[ -f "${DEPLOY_STATE_FILE}" ]] || abort "deploy-state missing"
journal_exists && abort "pending transaction exists"

compatible="$(journal_field_from_state previous_manual_rollback_compatible)"
[[ "${compatible}" == "True" || "${compatible}" == "true" ]] || abort "already marked incompatible"

SQL_FILE="${1:?path to destructive SQL required}"
[[ -f "${SQL_FILE}" ]] || abort "SQL file not found"

"${SCRIPT_DIR}/backup-postgres.sh"

"${PYTHON}" - <<'PY'
import os, sys
sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from state_ops import load, save
state = load(os.environ["DEPLOY_STATE_FILE"]) or {}
state["previous_manual_rollback_compatible"] = False
save(os.environ["DEPLOY_STATE_FILE"], state)
PY

"${SCRIPT_DIR}/write-compose-images-env.sh" 2>/dev/null || true
compose_prod exec -T postgres sh -ceu \
  "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -v ON_ERROR_STOP=1 -f -" < "${SQL_FILE}"

release_deploy_lock
echo "cup-survey-destructive-migrate: OK"
