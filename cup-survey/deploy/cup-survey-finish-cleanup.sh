#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=finish-cleanup.sh
source "${SCRIPT_DIR}/finish-cleanup.sh"

acquire_deploy_lock
_finish_cleanup
release_deploy_lock
