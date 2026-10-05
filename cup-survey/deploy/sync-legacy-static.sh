#!/usr/bin/env bash
# Sync nginx-served static from cup-survey-app:current using additive merge.
set -euo pipefail
cd /opt/cup-survey
chmod +x deploy/merge-static-assets.sh 2>/dev/null || true
IMAGE_REF="${1:-cup-survey-app:current}"
IMAGE_ID="$(docker image inspect --format '{{.Id}}' "${IMAGE_REF}")"
METADATA_FILE="$(mktemp /tmp/cup-survey-merge-meta.XXXXXX.json)"
./deploy/merge-static-assets.sh "${IMAGE_REF}" "${IMAGE_ID}" "${METADATA_FILE}"
echo "sync-legacy-static: OK image=${IMAGE_REF}"
