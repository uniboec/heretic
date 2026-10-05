#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

docker network inspect "${DOCKER_NETWORK}" >/dev/null 2>&1 || docker network create "${DOCKER_NETWORK}"

ensure_compose_images_env
POSTGRES_CID="$(compose_prod ps -q postgres 2>/dev/null | head -1)"
[[ -n "${POSTGRES_CID}" ]] || abort "postgres container not found"

POSTGRES_NAME="$(docker inspect --format '{{.Name}}' "${POSTGRES_CID}" | sed 's#^/##')"
attached="$(docker network inspect "${DOCKER_NETWORK}" --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null || true)"
if ! grep -qw "${POSTGRES_NAME}" <<< "${attached}"; then
  docker network connect "${DOCKER_NETWORK}" "${POSTGRES_CID}" --alias postgres
fi

docker run --rm --network "${DOCKER_NETWORK}" alpine sh -c 'nc -zvw2 postgres 5432'
echo "network-transition: OK"
