#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

EXPECTED_RELEASE="${1:?expected release id}"
EXPECTED_SHA="${2:?expected git sha}"
ITERATIONS="${3:-5}"
INTERVAL="${4:-10}"

for _ in $(seq 1 "${ITERATIONS}"); do
  build_info="$(curl -fsS --max-time 20 "${PUBLIC_BASE_URL}/api/build-info")"
  echo "${build_info}" | grep -q "\"releaseId\":\"${EXPECTED_RELEASE}\"" || abort "observe releaseId mismatch"
  echo "${build_info}" | grep -q "\"gitSha\":\"${EXPECTED_SHA}\"" || abort "observe gitSha mismatch"
  curl -fsS --max-time 20 "${PUBLIC_BASE_URL}/api/health" | grep -q '"ok":true' || abort "observe health failed"
  sleep "${INTERVAL}"
done

echo "observe-public: OK"
