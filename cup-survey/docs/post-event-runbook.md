# Post-event recovery runbook (cup-survey / cup26)

Operational companion for the post-event remediation plan v4.20. **Do not deploy to prod until P0 code + P0.9 are merged and tested.**

## Quick reference

| Path | Purpose |
|---|---|
| `deploy/post-event-recovery/compose-preflight.sh` | Verify compose maps `CUP_DISABLE_LAZY_RECONCILE` |
| `deploy/post-event-recovery/verify-freeze.sh` | Strict/standard freeze HTTP checks |
| `deploy/post-event-recovery/verify-protected-runtime.sh` | Image digest + env=1 gate |
| `deploy/post-event-recovery/pin-rollback-image.sh` | Pin `prod-pre-rc` digest before prune |
| `deploy/post-event-recovery/disk-precheck.sh` | Disk headroom before backup |
| `deploy/post-event-recovery/rollback-dry-run.sh` | Universal Strict-first rollback rehearsal |
| `deploy/post-event-recovery/acceptance-checks.sh` | Acceptance A/B/C/D API + data probes |
| `deploy/post-event-recovery/pin-pre-bg.sh` | Flow B step 11b: pin `PRE_BG_DIGEST` while legacy running |
| `deploy/post-event-recovery/p09-verification-checklist.sh` | P0.9 four-point gate before prod deploy |
| `deploy/post-event-recovery/migration-drill-local.sh` | Local restore + migrate + smoke on drill DB |
| `deploy/post-event-recovery/run-schedule-rebuild.sh` | Phase 3 schedule rebuild (dry-run default) |
| `deploy/post-event-recovery/execute-flow-a-rc.sh` | Full Flow A orchestrator (build → deploy → acceptance) |
| `deploy/post-event-recovery/verify-protected-runtime-bg.sh` | Protected runtime verify for both BG slots |
| `deploy-cup26-prod-local-build.py` | `--build-only` / `--upload-only --rc` (P0.9) |

## Release strategy

| Flow | When | Topology | Migrations |
|---|---|---|---|
| **A (RC)** | Emergency results fix | Legacy `:3001` | 0 |
| **B (RC→BG)** | After stable RC | `bootstrap-blue-green.sh` | Per `DEPLOY_MODE` |
| **C (Full)** | Schema required | Bootstrap from start | All pending |

Set `CUP_DISABLE_LAZY_RECONCILE=1` in `.env` for recovery deploys. Compose files **must** map the variable (see preflight).

## Protected runtime

```
PROTECTED = (running image ID == expected digest) AND (CUP_DISABLE_LAZY_RECONCILE=1 in container)
```

- `prod-pre-rc` is **unprotected** → remain **Strict** freeze after rollback
- `pre-bg` / RC hotfix require digest match **and** env=1 before Strict→Standard

## Freeze modes

1. **Strict** (before P0 deploy / any unverified rollback): nginx 503 on `/api/tournament/results`, `/team-rankings`, `/brackets`
2. **Standard** (after protected runtime verify): public GET allowed; writes blocked; P0.2b stays active
3. **Unfrozen** (after Acceptance C): admin writes restored; P0.2b remains until post-recovery release

Snippet: `deploy/post-event-recovery/nginx-strict-freeze.snippet` (add to nginx, reload).

## Deploy (local build)

```bash
# 1) Build once → writes deploy-cup26-release-manifest.json + .sha256 sidecar
python deploy-cup26-prod-local-build.py
# (stops before upload if you only need manifest — or let it upload after drill)

# 2) Migration drill on restored dump (same artifact)
DUMP_PATH=/path/to/postgres.dump \
ARTIFACT=/path/to/cup-survey-images.tar.gz \
MANIFEST=deploy-cup26-release-manifest.json \
  cup-survey/deploy/post-event-recovery/migration-drill-local.sh

# 3) P0.9 checklist
cup-survey/deploy/post-event-recovery/p09-verification-checklist.sh \
  deploy-cup26-release-manifest.json cup-survey-images.tar.gz

# 4) RC deploy: upload SAME tarball, skip migrations
python deploy-cup26-prod-local-build.py \
  --upload-only --rc \
  --artifact /path/to/cup-survey-images.tar.gz \
  --manifest deploy-cup26-release-manifest.json
```

Bootstrap without VPS build (images pre-loaded):

```bash
export CUP_SKIP_BUILD=1
export CUP_DISABLE_LAZY_RECONCILE=1
./deploy/bootstrap-blue-green.sh
```

## Rollback (universal)

1. Strict freeze → verify 503 on 3 GET routes
2. Recreate with pinned image (`compose up --force-recreate`)
3. `verify-protected-runtime.sh` or remain Strict for `prod-pre-rc`
4. Only then Strict→Standard

Classification template: `deploy/post-event-recovery/migration-classification-template.env`

## Acceptance

```bash
ACCEPTANCE_PHASE=A ./deploy/post-event-recovery/acceptance-checks.sh   # results 32/76, brackets active=0
ACCEPTANCE_PHASE=B ./deploy/post-event-recovery/acceptance-checks.sh   # champion stored complete + awards queue
ACCEPTANCE_PHASE=C ./deploy/post-event-recovery/acceptance-checks.sh   # team-rankings complete, 16 bronzes
ACCEPTANCE_PHASE=D ./deploy/post-event-recovery/acceptance-checks.sh   # A + B + C
```

Acceptance B data fix (if probe fails before deploy side-effects):

```bash
npx tsx scripts/fix-champion-stored-status-prod-once.ts --dry-run
```

Manual podium categories (w41, w48, w26, w32, 11× three_way) — spot-check after A.

## Later phases (after P0)

- **Schedule** (phase 3): `npx tsx scripts/repair-schedule-legacy.ts`
- **Announcer / awards** (phase 5): only after BG migrations + Unfreeze
- **Retire one-off scripts**: see `scripts/archive/post-event-workarounds/README.md`
