#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

TAG="${1:?release tag required}"
STATUS="$("${SCRIPT_DIR}/check-migration-status.sh" "${TAG}")"

case "${STATUS}" in
  PENDING) echo "required"; exit 0 ;;
  BROKEN|UNKNOWN) abort "migration status ${STATUS}" ;;
  UP_TO_DATE)
    latest="$(find "${POSTGRES_BACKUP_DIR}" -maxdepth 1 -name 'postgres-*.dump' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | awk '{print $2}')"
    if [[ -z "${latest}" ]]; then
      echo "required"
      exit 0
    fi
    age_hours=$(( ( $(date +%s) - $(stat -c %Y "${latest}" 2>/dev/null || stat -f %m "${latest}") ) / 3600 ))
    if [[ "${age_hours}" -ge 12 ]]; then
      echo "required"
    else
      echo "skip"
    fi
    ;;
  *) abort "unknown migration status ${STATUS}" ;;
esac
