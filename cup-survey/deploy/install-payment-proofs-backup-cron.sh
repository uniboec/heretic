#!/usr/bin/env bash
# Install daily backup cron for payment receipts (03:15 UTC).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

CRON_LINE="15 3 * * * ${APP_DIR}/deploy/backup-payment-proofs.sh >> /var/log/cup-survey-payment-proofs-backup.log 2>&1"
MARKER="# cup-survey-payment-proofs-backup"

TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -v "${MARKER}" | grep -v 'backup-payment-proofs.sh' > "${TMP}" || true
{
  cat "${TMP}"
  echo "${MARKER}"
  echo "${CRON_LINE}"
} | crontab -
rm -f "${TMP}"

echo "install-payment-proofs-backup-cron: OK"
