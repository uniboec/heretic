# Design DNA — cup-survey

Главная страница (`TournamentPage` + `TournamentHero`) — визуальный эталон. Из неё извлечены правила; формы, таблицы и admin дополняют систему.

## Color roles

| Token | Role | Value |
|-------|------|-------|
| `--color-accent` | Primary CTA, links, focus | `#c41e2a` |
| `--color-accent-hover` | Hover accent | `#a31822` |
| `--color-accent-soft` | Soft accent surfaces | `#fef2f3` |
| `--color-foreground` | Primary text | `#0f1419` |
| `--color-muted` | Secondary text | `#64748b` |
| `--color-background` | Page background | `#eef0f3` |
| `--color-surface` / `--color-background-soft` | Section/card alt bg | `#f7f8fa` |
| `--color-card` | Card surface | `#ffffff` |
| `--color-border` | Borders | `#e2e8f0` |
| `--color-success` | Success semantic | `#0d9b5c` |
| `--color-info` | Info semantic | `#1a4fd6` |
| `--color-warning` | Warning semantic | `#b45309` |
| `--color-danger` | Error/destructive | `#b91c1c` |

Semantic soft/border/foreground variants: `*-soft`, `*-border`, `*-foreground` for warning, danger, success, info, violet, sky, neutral, bronze.

## Typography

- Font: Manrope (`--font-sans`)
- Scale: `--text-xs` … `--text-4xl` (0.75rem – 2.25rem)
- Hero: bold/extrabold, uppercase CTA on primary buttons

## Spacing & layout

- Container max-width: `72rem` (`.event-container`)
- Horizontal padding: `1rem` mobile, `1.5rem` sm+
- Section gap (landing): `1.25rem` (`--spacing-5`)

## Radius & shadows

- Card radius: `--radius-card` (1rem)
- Button/input radius: `--radius-xl` (1.25rem) via primitives
- Card shadow: `--shadow-card`, hover: `--shadow-card-hover`

## Breakpoints

sm 640, md 768, lg 1024, xl 1280 (Tailwind defaults)

## Z-index (`:root`, outside `@theme`)

`--z-modal` 50, `--z-modal-nested` 60, `--z-overlay` 70, `--z-popover` 200

## Primitives (`components/ui`)

`Button`, `Input`, `Select`, `Textarea`, `PhoneInput`, `Card`, `Modal`, `Table`, `Badge`, `StatusBadge`

## Legacy compatibility (temporary)

`--event-*` and `--bracket-*` in `.event-layout` / `.bracket-tree` — aliases only, do not add new values.

## Sources beyond homepage

- **Registration** (`RegistrationForm`): multi-step forms, validation, collapse panels
- **Participants** (`ParticipantsPage`): filters, view toggles, grouped lists
- **Admin** (`AdminRegistrationsDashboard`): tables, badges, modals, dense UI

## Judge Console (`/admin/bouts/mats/[matIndex]/control`)

Sports Control Deck for mat judges. Base tokens from `@theme`; functional layer in `.judge-console` (`globals.css`):

| CSS variable | Role |
|---|---|
| `--judge-corner-red` / `--judge-corner-blue` | Corner identity (not `--color-danger` / `--color-info`) |
| `--judge-control-dark` | Center clock / decision modules |
| `--judge-fight-active` | Fight/start CTA |
| `--judge-amber` | Correction mode, period warning |

**Layout zones (Z1–Z5):** ServiceBar → ModeStrip → WorkGrid → ActionBar → Footer (history + queue).

**Grid variants:** `grid3Scoring` (41/18/41) for prep/live/correction; `grid3Decision` (34/32/34) for activity/confirmation.

**Touch targets:** scoring ≥56px, primary actions ≥52px, secondary ≥48px.

**Responsive:** `< lg` shows landscape gate (no vertical stack). Work area `max-w-[1760px]`, full width with 12–20px padding.

**Components:** `components/admin/bouts/mat-control/judge/` — `JudgeModeShell`, `JudgeWorkGrid`, phase centers (`JudgePrepCenter`, `JudgeClockCenter`, `JudgeActivityCenter`, `JudgeResultCenter`).
