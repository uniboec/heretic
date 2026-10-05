#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

PORT="${1:?port required}"
EXPECTED_RELEASE="${2:?expected release id}"
EXPECTED_SHA="${3:?expected git sha}"
HOST_HEADER="${PRODUCTION_HOST}"

curl_common() {
  curl -fsS --max-time 20 \
    -H "Host: ${HOST_HEADER}" \
    -H "X-Forwarded-Proto: https" \
    "$@"
}

health="$(curl_common "http://127.0.0.1:${PORT}/api/health")"
echo "${health}" | grep -q '"ok":true' || abort "health failed on :${PORT}"

build_info="$(curl_common "http://127.0.0.1:${PORT}/api/build-info")"
echo "${build_info}" | grep -q "\"releaseId\":\"${EXPECTED_RELEASE}\"" || abort "releaseId mismatch"
echo "${build_info}" | grep -q "\"gitSha\":\"${EXPECTED_SHA}\"" || abort "gitSha mismatch"

probe="${PAYMENT_PROOFS_HOST_DIR}/.smoke-probe-$$"
touch "${probe}" && rm -f "${probe}"

html="$(curl_common "http://127.0.0.1:${PORT}/")"
css="$(printf '%s' "${html}" | grep -oE '/_next/static/[^"]+\.css' | head -1 || true)"
js="$(printf '%s' "${html}" | grep -oE '/_next/static/[^"]+\.js' | head -1 || true)"
[[ -n "${css}" ]] && curl_common "http://127.0.0.1${css}" >/dev/null
[[ -n "${js}" ]] && curl_common "http://127.0.0.1${js}" >/dev/null

echo "smoke-inactive-slot: OK :${PORT}"
