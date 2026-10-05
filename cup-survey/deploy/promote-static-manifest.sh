#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

METADATA_FILE="${1:?metadata json required}"
DEPLOY_ID="${2:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

export MANIFEST_PATH DEPLOY_ID METADATA_FILE
"${PYTHON}" - <<'PY'
import json
import os
import sys

sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from static_manifest import retire_and_promote_current_atomic

with open(os.environ["METADATA_FILE"], encoding="utf-8") as handle:
    meta = json.load(handle)
entry = {
    "deploy_id": os.environ["DEPLOY_ID"],
    "build_id": meta["build_id"],
    "image_id": meta["image_id"],
    "image_ref": meta["image_ref"],
    "deployed_at": os.environ["DEPLOY_ID"],
    "retired_at": None,
    "file_count": meta["file_count"],
    "files": meta["files"],
}
retire_and_promote_current_atomic(
    os.environ["MANIFEST_PATH"], entry, retired_at=os.environ["DEPLOY_ID"]
)
PY

echo "promote-static-manifest: OK"
