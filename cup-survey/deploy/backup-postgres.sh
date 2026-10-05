#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

mkdir -p "${POSTGRES_BACKUP_DIR}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PARTIAL="${POSTGRES_BACKUP_DIR}/postgres-${STAMP}.dump.partial"
FINAL="${POSTGRES_BACKUP_DIR}/postgres-${STAMP}.dump"

"${SCRIPT_DIR}/write-compose-images-env.sh" 2>/dev/null || true
compose_prod exec -T postgres sh -ceu \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner -Fc' \
  > "${PARTIAL}"

if command -v pg_restore >/dev/null 2>&1; then
  pg_restore --list "${PARTIAL}" >/dev/null
else
  docker run --rm -i postgres:15-alpine pg_restore --list < "${PARTIAL}" >/dev/null
fi
size="$(wc -c < "${PARTIAL}")"
[[ "${size}" -gt 1024 ]] || abort "backup too small"

mv "${PARTIAL}" "${FINAL}"
sha256sum "${FINAL}" >> "${POSTGRES_BACKUP_DIR}/checksums.sha256"
echo "BACKUP_FILE=${FINAL}"
