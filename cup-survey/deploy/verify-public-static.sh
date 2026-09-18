#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${VERIFY_DOMAIN:-https://cup26.mma66.ru}"
PREV_CSS="${1:?PREV_CSS required}"
PREV_JS="${2:?PREV_JS required}"
CUR_CSS="${3:?CURRENT_CSS required}"
CUR_JS="${4:?CURRENT_JS required}"

check_ok() {
  local path="$1"
  local expect_ct="$2"
  local url="${DOMAIN}${path}"
  local headers
  headers="$(curl -fsSI --max-time 20 "${url}")"
  echo "${headers}" | grep -qi "HTTP/.* 200" || { echo "not 200: ${url}"; return 1; }
  echo "${headers}" | grep -qi "content-type:.*${expect_ct}" || { echo "bad content-type: ${url}"; return 1; }
  echo "${headers}" | grep -qi "cache-control:.*immutable" || { echo "missing immutable: ${url}"; return 1; }
  echo "${headers}" | grep -qi "max-age=31536000" || { echo "missing max-age: ${url}"; return 1; }
  echo "OK ${url}"
}

check_404_no_immutable() {
  local url="${DOMAIN}/_next/static/chunks/definitely-missing-test.css"
  local headers
  headers="$(curl -fsSI --max-time 20 "${url}" || true)"
  echo "${headers}" | grep -qi "HTTP/.* 404" || { echo "not 404: ${url}"; return 1; }
  if echo "${headers}" | grep -qi "cache-control:.*immutable"; then
    echo "404 has immutable cache: ${url}"
    return 1
  fi
  if echo "${headers}" | grep -qi "max-age=31536000"; then
    echo "404 has year cache: ${url}"
    return 1
  fi
  echo "OK 404 ${url}"
}

check_ok "${PREV_CSS}" "text/css"
check_ok "${PREV_JS}" "javascript"
check_ok "${CUR_CSS}" "text/css"
check_ok "${CUR_JS}" "javascript"
check_404_no_immutable

echo "verify-public-static: OK"
