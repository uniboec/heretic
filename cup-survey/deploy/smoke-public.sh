#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

EXPECTED_RELEASE="${1:?expected release id}"
EXPECTED_SHA="${2:?expected git sha}"

build_info=""
for attempt in 1 2 3 4 5; do
  build_info="$(curl -fsS --max-time 20 "${PUBLIC_BASE_URL}/api/build-info" 2>/dev/null || true)"
  if echo "${build_info}" | grep -q "\"releaseId\":\"${EXPECTED_RELEASE}\"" \
    && echo "${build_info}" | grep -q "\"gitSha\":\"${EXPECTED_SHA}\""; then
    break
  fi
  if [[ "${attempt}" -eq 5 ]]; then
    echo "build_info=${build_info}" >&2
    abort "public build identity mismatch after ${attempt} attempts"
  fi
  sleep 2
done

curl -fsS --max-time 20 "${PUBLIC_BASE_URL}/api/health" | grep -q '"ok":true' || abort "public health failed"
curl -fsS --max-time 20 "${PUBLIC_BASE_URL}/" >/dev/null

echo "smoke-public: OK"
