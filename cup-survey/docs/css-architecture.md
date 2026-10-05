# CSS architecture

Status: **migration complete**. Canonical tokens, cascade layers, and Tailwind primitives are the source of truth.

## Entry point

[`app/layout.tsx`](../app/layout.tsx) imports only [`app/globals.css`](../app/globals.css).

## Cascade layers (weak → strong)

```
@layer theme, base, domains, components, utilities;
```

| Layer | Source | Role |
|-------|--------|------|
| *(top-level)* | `@theme` in `globals.css` | Canonical `--color-*` tokens (`--color-*: initial` closes Tailwind defaults) |
| `base` | `styles/base.css` | `body`, collapse panels, `prefers-reduced-motion` |
| `domains` | `components/tournament/brackets/bracket.css` | Olympic bracket geometry + print overrides |
| `components` | `styles/modals.css` | Shared keyframe animations (`app-modal-*`, payment shimmer) |
| `utilities` | inline in `globals.css` | `animate-participants-view-in`, payment QR shimmer |

**Removed (migrated to Tailwind):** `event.css`, `admin.css`, `tournament-public.css`, `admin-bracket-consolidation-dialog.css`, `admin-bouts.css`.

## Styling in application code

| Layer | Location | Use |
|-------|----------|-----|
| Primitives | `components/ui/*` | `Button`, `Input`, `Select`, `Table`, `Modal`, `Card`, `Badge` |
| Domain surfaces | `lib/ui/*SurfaceStyles.ts` | Shared Tailwind class strings per zone (event, admin, participants) |
| Page components | `components/tournament/*`, `components/admin/*` | Compose primitives + surface styles |

**Contract:** new colors only in `@theme` as `--color-*`. No `--ds-*`, `--event-*`, or `--bracket-*`. No Tailwind default palette (`slate-*`, `emerald-*`, etc.) outside DNA tokens.

## Tokens (`@theme`)

Semantic palette: `accent`, `foreground`, `muted`, `background`, `surface`, `card`, `border`, plus `success`, `info`, `warning`, `danger`, `violet`, `sky`, `neutral`, `bronze`, `partner-*`, `sber`.

Layout vars in `:root`: `--header-height`, `--z-modal`, `--z-overlay`, `--z-popover`, etc.

## Cross-zone rules

- No `.event-*` in `components/admin/`
- No `.admin-*` in public tournament components (except E2E hook class names on elements)
- Bracket geometry: `olympicBracketGeometry.ts` → CSS custom properties `--olympic-*` in `bracket.css`

## `!important` policy

Allowed only for:

- `prefers-reduced-motion` in `base.css`
- `@media print` overrides in `bracket.css`

Not counted in UI debt scoreboard (print blocks excluded).

## Guards

```bash
npm run ui-debt                    # scoreboard — all metrics must pass
npm run lint:css                   # stylelint
node scripts/check-tailwind-default-colors.mjs
npm run test:e2e:visual          # Playwright visual regression
```

CI: `.github/workflows/ci.yml` — `test` job (ui-debt, lint:css, tailwind check) + `visual` job.

## Visual regression

- Suite: `npm run test:e2e:visual` (Chromium baselines)
- Update after intentional UI changes: `npm run test:e2e:visual:update`
- Coverage: home, registration, participants, brackets (incl. print), admin login, registrations, brackets, bouts, survey, modals

## Survey (frozen)

Public UI removed; `SurveyResponse` data preserved; `/admin/survey` read-only. See [survey-deprecation.md](./survey-deprecation.md).

## Further reading

- [Design DNA](./ui-dna/README.md)
- [UI debt scoreboard](./ui-dna/scoreboard.md)
- [Contributing rules](./ui-dna/contributing.md)
