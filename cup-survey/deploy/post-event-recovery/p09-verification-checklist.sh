#!/usr/bin/env bash
set -euo pipefail

MANIFEST="${1:-deploy-cup26-release-manifest.json}"
ARTIFACT="${2:-}"

echo "P0.9 verification checklist"

if [[ -f "$MANIFEST" ]]; then
  echo "[1] manifest present: $MANIFEST"
  python3 - <<'PY' "$MANIFEST"
import json, sys
m = json.load(open(sys.argv[1], encoding="utf-8"))
required = ["release_id", "git_sha", "app_image_id", "migrate_image_id", "artifact_sha256"]
missing = [k for k in required if not m.get(k)]
if missing:
    raise SystemExit(f"missing manifest keys: {missing}")
print("  release_id=", m["release_id"])
print("  app_image_id=", m["app_image_id"])
print("  artifact_sha256=", m["artifact_sha256"])
PY
else
  echo "[1] FAIL: manifest missing ($MANIFEST)"
  exit 1
fi

if [[ -n "$ARTIFACT" ]]; then
  echo "[2] artifact sha256 matches manifest"
  python3 - <<'PY' "$MANIFEST" "$ARTIFACT"
import hashlib, json, sys
manifest = json.load(open(sys.argv[1], encoding="utf-8"))
path = sys.argv[2]
h = hashlib.sha256()
with open(path, "rb") as f:
    for chunk in iter(lambda: f.read(1024 * 1024), b""):
        h.update(chunk)
actual = h.hexdigest()
expected = manifest["artifact_sha256"]
if actual != expected:
    raise SystemExit(f"sha256 mismatch expected={expected} actual={actual}")
print("  sha256 OK")
PY
else
  echo "[2] skip artifact sha256 (no artifact path)"
fi

echo "[3] compose preflight"
"$(dirname "$0")/compose-preflight.sh"

echo "[4] deploy mode flags"
echo "  RC deploy must use --skip-migrate / --rc"
echo "  Flow B bootstrap must use CUP_SKIP_BUILD=1 when images pre-loaded"

echo "p09-verification-checklist: OK"
