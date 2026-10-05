# Survey deprecation (Phase 0.5)

Status: **Phase 0.5.4 complete** — public Survey UI removed; historical data preserved read-only.

## Product decision (frozen in Phase 0.5.3)

The pre-tournament coach survey was a one-time data collection flow. Tournament registration and operations no longer depend on it. Historical responses remain valuable for analytics and export.

| Asset | Decision |
|-------|----------|
| Public `/survey` route and UI | **Removed** (Phase 0.5.4) |
| `SurveyResponse` Prisma model + DB rows | **Preserve** — no DROP migrations |
| `/admin/survey` dashboard | **Keep** — read-only stats, list, CSV/XLSX export |
| `GET /api/admin/stats` | **Keep** |
| `GET /api/admin/responses` | **Keep** |
| `GET /api/admin/export` | **Keep** |
| `POST /api/survey` | **Disabled** — returns `410 Gone` |
| Admin delete endpoints | **Removed** — no `DELETE` on responses |
| Public nav link to `/survey` | **Never existed** in `lib/navigation.ts` |

## Phase dependency map

```
Phase 0 (visual baselines, CI)
  └── Phase 0.5.1 — inventory + decision doc (css-architecture.md Legacy Survey section)
        └── Phase 0.5.2 — decouple admin tables from `.survey-table` → `.admin-table`
              ├── Technical gate → unlocks CSS/token Phase 1–3
              └── Phase 0.5.3 — product decision recorded (this doc + frozen rules above)
                    └── Phase 0.5.4 — public UI removal + API read-only enforcement
                          └── Survey removal gate → unlocks Phase 4a/6 (dead `.survey-*` CSS purge)
```

Phase 0.5.3 and 0.5.4 are on the **product track**; they do not block Phase 1–3 after 0.5.2.

## What was removed (0.5.4)

| Path | Notes |
|------|-------|
| `app/survey/` | Public Next.js route |
| `components/survey/*` | 16 UI components (form steps, nav, entry-fee tracker) |
| `tests/e2e/survey.spec.ts` | Full flow + POST idempotency e2e |
| `tests/e2e/survey-variants.spec.ts` | Variant payload POST e2e |
| `app/api/admin/responses/[id]/route.ts` | DELETE-only handler |
| `--survey-nav-offset` ResizeObserver | Lived in removed `SurveyPage.tsx` |

## What remains (read-only stack)

### Routes & UI

- `app/admin/(panel)/survey/page.tsx` → `AdminDashboard`
- `components/admin/AdminDashboard.tsx` — aggregates + export links
- `components/admin/AdminResponsesList.tsx` — paginated list (no delete actions)
- `lib/navigation.ts` — admin nav item «Опрос» → `/admin/survey` (unchanged)

### API

| Endpoint | Methods | Role |
|----------|---------|------|
| `/api/survey` | `POST` → 410 | Closed to new submissions |
| `/api/admin/stats` | `GET` | Dashboard aggregates |
| `/api/admin/responses` | `GET` | Paginated response list |
| `/api/admin/export` | `GET` | CSV / XLSX download |

### Data & server libs (unchanged)

- `prisma/schema.prisma` — `SurveyResponse` model
- `lib/surveyResponse.ts` — label/format helpers for admin display
- `lib/analytics.ts` — stats computation
- `lib/entryFeeState.ts`, `lib/surveyDraft.ts` — entry-fee math (used by admin analytics)
- `lib/validation/surveySchema.ts` — schema retained for `scripts/verify-survey-variants.ts`

## Follow-up (not in 0.5.4)

1. **Survey CSS cleanup** — completed in Phase 6 (`.survey-*` blocks removed from `globals.css`; `.admin-table` owns table styling).
2. **`scripts/verify-survey-variants.ts`** — dev-only schema checker; no runtime consumer. Optional removal.
3. **Visual baseline** — `admin-survey-1440.png` in `tests/e2e/visual.spec.ts`; re-run if admin list copy changes.

## Blockers

None for 0.5.4 scope. CSS cleanup is intentionally deferred to Phase 4a/6 per migration plan.
