#!/usr/bin/env bash
set -euo pipefail

SWAP_FILE="${SWAP_FILE:-/swapfile}"
SWAP_SIZE_GB="${SWAP_SIZE_GB:-2}"

if swapon --show | grep -q "${SWAP_FILE}"; then
  echo "setup-swap-2g: already active ${SWAP_FILE}"
  swapon --show
  exit 0
fi

if [[ ! -f "${SWAP_FILE}" ]]; then
  fallocate -l "${SWAP_SIZE_GB}G" "${SWAP_FILE}"
  chmod 600 "${SWAP_FILE}"
  mkswap "${SWAP_FILE}"
fi

swapon "${SWAP_FILE}"
grep -q "${SWAP_FILE}" /etc/fstab || echo "${SWAP_FILE} none swap sw 0 0" >> /etc/fstab
sysctl -w vm.swappiness=10 >/dev/null
grep -q '^vm.swappiness=' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf

echo "setup-swap-2g: OK"
free -h
swapon --show
