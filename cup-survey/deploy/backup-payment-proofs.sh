#!/usr/bin/env bash
# Archive payment receipts from the host volume (safe to run before deploy / from cron).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

if [[ ! -d "${PAYMENT_PROOFS_HOST_DIR}" ]]; then
  echo "backup-payment-proofs: nothing to backup (${PAYMENT_PROOFS_HOST_DIR} missing)"
  exit 0
fi

FILE_COUNT="$(find "${PAYMENT_PROOFS_HOST_DIR}" -type f ! -name '.deploy-write-probe' 2>/dev/null | wc -l | tr -d ' ')"
if [[ "${FILE_COUNT}" == "0" ]]; then
  echo "backup-payment-proofs: skip (no files)"
  exit 0
fi

mkdir -p "${PAYMENT_PROOFS_BACKUP_DIR}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="${PAYMENT_PROOFS_BACKUP_DIR}/payment-proofs-${STAMP}.tar.gz"

tar -czf "${ARCHIVE}" -C "$(dirname "${PAYMENT_PROOFS_HOST_DIR}")" "$(basename "${PAYMENT_PROOFS_HOST_DIR}")"
echo "backup-payment-proofs: OK ${ARCHIVE} (${FILE_COUNT} files)"

# Keep last 60 archives.
ls -1t "${PAYMENT_PROOFS_BACKUP_DIR}"/payment-proofs-*.tar.gz 2>/dev/null | tail -n +61 | xargs -r rm -f
