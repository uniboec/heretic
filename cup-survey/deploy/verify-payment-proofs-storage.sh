#!/usr/bin/env bash
# Fail deploy if payment receipts are not on a mounted persistent volume.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
cup_survey_cd

RUNNING_CID="$(running_active_app_cid)"
SERVICE="$(active_app_service)"
if [[ -z "${RUNNING_CID}" ]]; then
  echo "verify-payment-proofs-storage: no running ${SERVICE} container" >&2
  exit 1
fi

MOUNT_SOURCE="$(docker inspect "${RUNNING_CID}" --format '{{range .Mounts}}{{if eq .Destination "'"${PAYMENT_PROOFS_CONTAINER_DIR}"'"}}{{.Source}}{{end}}{{end}}')"
if [[ "${MOUNT_SOURCE}" != "${PAYMENT_PROOFS_HOST_DIR}" ]]; then
  echo "verify-payment-proofs-storage: volume mount mismatch" >&2
  echo "  expected source: ${PAYMENT_PROOFS_HOST_DIR}" >&2
  echo "  actual source:   ${MOUNT_SOURCE:-<not mounted>}" >&2
  exit 1
fi

PROBE="${PAYMENT_PROOFS_HOST_DIR}/.deploy-write-probe"
rm -f "${PROBE}"
compose_prod exec -T "${SERVICE}" sh -c "touch ${PAYMENT_PROOFS_CONTAINER_DIR}/.deploy-write-probe"
if [[ ! -f "${PROBE}" ]]; then
  echo "verify-payment-proofs-storage: app cannot write to persistent volume" >&2
  exit 1
fi
rm -f "${PROBE}"

echo "verify-payment-proofs-storage: OK service=${SERVICE} mount=${MOUNT_SOURCE}"
