#!/usr/bin/env bash
set -euo pipefail

# Flow A (RC path) orchestration from repo root.
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

MANIFEST="${MANIFEST:-$ROOT/deploy-cup26-release-manifest.json}"
ARTIFACT="${ARTIFACT:-$ROOT/deploy-artifacts/cup-survey-images.tar.gz}"
DUMP_PATH="${DUMP_PATH:-}"

echo "=== Flow A RC recovery orchestrator ==="

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  python deploy-cup26-prod-local-build.py --build-only
fi

"$ROOT/cup-survey/deploy/post-event-recovery/p09-verification-checklist.sh" \
  "$MANIFEST" "$ARTIFACT"

if [[ -n "$DUMP_PATH" && -f "$DUMP_PATH" ]]; then
  DUMP_PATH="$DUMP_PATH" ARTIFACT="$ARTIFACT" MANIFEST="$MANIFEST" \
    "$ROOT/cup-survey/deploy/post-event-recovery/migration-drill-local.sh"
else
  echo "SKIP migration drill (set DUMP_PATH to enable)"
fi

python deploy-cup26-prod-local-build.py \
  --upload-only --rc \
  --artifact "$ARTIFACT" \
  --manifest "$MANIFEST"

echo "=== Post-deploy acceptance ==="
BASE_URL="${BASE_URL:-https://cup26.mma66.ru}" \
  ACCEPTANCE_PHASE=D \
  "$ROOT/cup-survey/deploy/post-event-recovery/acceptance-checks.sh"

echo "execute-flow-a-rc: OK"
