#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

METADATA_FILE="${1:?metadata json required}"

SHARED_STATIC_ROOT="${SHARED_STATIC_ROOT}" METADATA_FILE="${METADATA_FILE}" "${PYTHON}" - <<'PY'
import json
import os

shared = os.environ["SHARED_STATIC_ROOT"]
with open(os.environ["METADATA_FILE"], encoding="utf-8") as handle:
    meta = json.load(handle)
for rel in meta.get("files", []):
    path = os.path.join(shared, rel)
    if not os.path.isfile(path):
        raise SystemExit(f"missing static file: {path}")
print("pre-switch-static-check: OK")
PY
