# Archived post-event one-off scripts

Archived prod-once workarounds (moved from `scripts/`):

- `fix-all-three-way-placements-prod-once.ts`
- `fix-close-girls2-w26-anita-podium-prod-once.ts`
- `fix-close-boys3-w32-podium-prod-once.ts`
- `fix-bahtin-nikiforov-novice-y2-w48-prod-once.ts`
- `fix-youths2-w41-bronze-two-prod-once.ts`
- `fix-youths2-w41-close-podium-prod-once.ts`
- `fix-m-boys-3-w32-placements-prod-once.ts`

Run from archive path only during explicit remediation under freeze, before P0 deploy makes them unnecessary.

P0.1/P0.2/P0.3 make read-path safe; explicit correction scripts remain the write-path for manual podium fixes during freeze.

Do not run these after unfreeze unless documented in a new `ResultCorrectionCase`.
