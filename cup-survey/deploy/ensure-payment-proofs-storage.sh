#!/usr/bin/env bash
# Persistent host directory for uploaded payment receipts (survives container recreate).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

mkdir -p "${PAYMENT_PROOFS_HOST_DIR}"
chown -R "${PAYMENT_PROOFS_APP_UID}:${PAYMENT_PROOFS_APP_UID}" "${PAYMENT_PROOFS_HOST_DIR}"
chmod 755 "${PAYMENT_PROOFS_HOST_DIR}"

if ! grep -q "${PAYMENT_PROOFS_HOST_DIR}:${PAYMENT_PROOFS_CONTAINER_DIR}" "${COMPOSE_FILE}"; then
  echo "ensure-payment-proofs-storage: volume mount missing in ${COMPOSE_FILE}" >&2
  echo "  required: ${PAYMENT_PROOFS_HOST_DIR}:${PAYMENT_PROOFS_CONTAINER_DIR}" >&2
  exit 1
fi

# One-time migration from legacy in-app path (pre-volume deploys).
LEGACY_DIR="${APP_DIR}/data/payment-proofs"
if [[ -d "${LEGACY_DIR}" ]]; then
  cp -an "${LEGACY_DIR}/." "${PAYMENT_PROOFS_HOST_DIR}/" 2>/dev/null || true
  chown -R "${PAYMENT_PROOFS_APP_UID}:${PAYMENT_PROOFS_APP_UID}" "${PAYMENT_PROOFS_HOST_DIR}"
fi

echo "ensure-payment-proofs-storage: OK ${PAYMENT_PROOFS_HOST_DIR}"
