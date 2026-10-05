# UI Debt Scoreboard

Обновляется командой `npm run ui-debt`. Цели — критерий завершения миграции.

| Метрика | Baseline (2026-09-28) | Текущее (2026-09-28) | Цель |
|---------|----------------------|----------------------|------|
| Hardcoded colors в domain CSS | 152 | **0** | 0 |
| `--ds-*` определений в @theme | 16 | **0** | 0 |
| `var(--ds-*)` использований | 61 | **0** | 0 |
| Legacy `--event-*` (unique) | 20 | **0** | 0 |
| Legacy `--bracket-*` (unique) | 14 | **0** | 0 |
| Tailwind default colors вне DNA | 82 | **0** | 0 |
| `!important` в domain CSS | 7 | **0** | ≈0 (print исключён) |
| Глобальных button/input selectors | 7 | **0** | 0 |
| Строк legacy domain CSS | 9854 | **722** | <1500 |
| Raw `<button>` вне components/ui | 70 | **0** | 0 |
| Raw `<input>` вне components/ui | 20 | **0** | 0 |
| Visual regression critical pages | 3 группы | **25/25 зелёные** | все критические |

## Выполнено

- Canonical `@theme` с `--color-*: initial` (закрытая palette)
- CSS Cascade Layers: `theme, base, legacy, domains, components, utilities`
- `--ds-*`, `--event-*`, `--bracket-*` полностью удалены
- `event.css`, `admin.css`, `tournament-public.css`, `admin-bracket-consolidation-dialog.css` удалены
- Все публичные и admin-страницы на Tailwind + `lib/ui/*SurfaceStyles.ts`
- Raw `<button>` / `<input>` → `components/ui` primitives
- CI guards: `ui-debt`, `lint:css`, `check-tailwind-default-colors.mjs`
- Stylelint + contributing rules

## Оставшийся legacy CSS (~720 строк)

| Файл | Назначение |
|------|------------|
| `components/tournament/brackets/bracket.css` | Olympic tree geometry + print |
| `styles/modals.css` | Keyframe animations |

Геометрия сетки и print-стили не переносятся в utility-классы.

## Команды

```bash
npm run ui-debt
npm run lint:css
node scripts/check-tailwind-default-colors.mjs
node scripts/purge-dead-css-classes.mjs
```
