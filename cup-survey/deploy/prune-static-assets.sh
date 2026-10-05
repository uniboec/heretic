#!/usr/bin/env bash
# Safe prune for retained Next.js static assets. PRUNE_DRY_RUN=1 for dry-run only.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

: "${SHARED_STATIC_ROOT:?}"
: "${MANIFEST_PATH:?}"

if [[ "${SHARED_STATIC_ROOT}" != /opt/cup-survey-shared/_next/static ]]; then
  echo "refusing: unexpected SHARED_STATIC_ROOT" >&2
  exit 1
fi

if [[ ! -f "${MANIFEST_PATH}" ]]; then
  echo "prune aborted: manifest missing" >&2
  exit 1
fi

RETENTION_DAYS="${STATIC_RETENTION_DAYS:-16}"
KEEP_RECENT_DEPLOYS="${STATIC_KEEP_RECENT_DEPLOYS:-3}"
PRUNE_DRY_RUN="${PRUNE_DRY_RUN:-0}"

export MANIFEST_PATH SHARED_STATIC_ROOT RETENTION_DAYS KEEP_RECENT_DEPLOYS PRUNE_DRY_RUN
"${PYTHON}" - <<'PY'
import os
import sys
from pathlib import Path

sys.path.insert(0, os.environ.get("DEPLOY_SCRIPT_DIR", "/opt/cup-survey/deploy"))
from static_manifest import (
    ManifestCorruptError,
    ManifestMissingError,
    compute_protected_set,
    get_current_deploy,
    load_manifest,
    resolve_under_static_root,
    utc_now,
)

manifest_path = Path(os.environ["MANIFEST_PATH"])
static_root = Path(os.environ["SHARED_STATIC_ROOT"])
retention_days = int(os.environ["RETENTION_DAYS"])
keep_recent_deploys = int(os.environ["KEEP_RECENT_DEPLOYS"])
dry_run = os.environ.get("PRUNE_DRY_RUN", "0") == "1"
now = utc_now()

try:
    manifest = load_manifest(manifest_path)
except ManifestMissingError as exc:
    print(f"prune aborted: {exc}", file=sys.stderr)
    sys.exit(1)
except ManifestCorruptError as exc:
    print(f"prune aborted: corrupt manifest: {exc}", file=sys.stderr)
    sys.exit(1)

if get_current_deploy(manifest) is None:
    print("prune aborted: no current deploy", file=sys.stderr)
    sys.exit(1)

protected = compute_protected_set(
    manifest,
    retention_days=retention_days,
    keep_recent_deploys=keep_recent_deploys,
    now=now,
)

delete_files = []
keep_files = []

for path in sorted(static_root.rglob("*")):
    if not path.is_file():
        continue
    rel = path.relative_to(static_root).as_posix()
    resolve_under_static_root(static_root, rel)
    if rel in protected.protected_paths:
        keep_files.append(path)
        print(f"KEEP PROTECTED {rel}")
        continue
    delete_files.append(path)
    action = "DELETE(dry-run)" if dry_run else "DELETE"
    print(f"{action} {rel}")

if dry_run:
    print(f"dry-run complete: would_delete={len(delete_files)} keep={len(keep_files)}")
    sys.exit(0)

for path in delete_files:
    path.unlink()

for path in sorted(static_root.rglob("*"), reverse=True):
    if path.is_dir():
        try:
            path.rmdir()
        except OSError:
            pass

print(f"prune complete: deleted={len(delete_files)} keep={len(keep_files)}")
PY
