#!/bin/sh
set -e

mkdir -p /app/data/payment-proofs /app/data/announcer-cache
chown -R nextjs:nodejs /app/data/payment-proofs /app/data/announcer-cache 2>/dev/null || true

exec su-exec nextjs "$@"