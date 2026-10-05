# UI DNA — технический аудит (baseline)

Дата: 2026-09-28. Scope: `cup-survey` only.

## Корневые причины конфликтов

1. **Гибрид Tailwind + legacy BEM** — одни элементы используют `event-*` классы, Tailwind utilities и CSS variables одновременно.
2. **Unlayered CSS** (до миграции) — `event.css` / `admin.css` перебивали layered Tailwind по правилам каскада.
3. **Параллельные палитры** — `--ds-*`, hardcoded hex, Tailwind defaults (`red-*`, `amber-*`).
4. **Дублирование primitives** — `.event-input` vs `Input`, `.event-card` vs `Card`.

## Карта токенов (до → после)

| Namespace | Статус |
|-----------|--------|
| `--ds-*` | Удалены → canonical `@theme` |
| `--color-*` | Единственный источник (+ `--color-*: initial` reset) |
| `--event-*` | Удалены |
| `--bracket-*` / `--olympic-*` | Только `--olympic-*` в `bracket.css` (геометрия) |
| `:root` z-index / header | Вне `@theme` |

## CSS-архитектура (финал)

```
@theme { top-level, --color-*: initial }
@layer theme, base, domains, components, utilities
@import "tailwindcss"
@layer base → base.css
@layer domains → bracket.css
@layer components → modals.css (keyframes)
```

Приоритет: `base` < `domains` < `components` < `utilities`. Стили страниц — Tailwind + `lib/ui/*SurfaceStyles.ts`.

## Опасные селекторы (baseline)

- `.event-participants-view-toggle button` (event.css)
- `.admin-card-actions button`, `.admin-page-actions button` (admin.css)
- `.event-mobile-menu-cta--active button` (event.css)

## Матрица дублирования

| Legacy | Primitive | Действие |
|--------|-----------|----------|
| `.event-card` | `Card` | Постепенная миграция layout-блоков |
| `.event-input` | `Input` / `Select` | EventFormFields, ParticipantsPage filters → primitives |
| `.admin-table` | `Table` | Admin wave 3 |
| `.app-modal-*` | `Modal` | Оставить в @layer components |

## Приоритет миграции

1. ✅ Tokens + cascade layers + Tailwind defaults → DNA
2. ✅ Registration forms + Participants filters → primitives
3. Public complex (brackets, bouts) — `--bracket-*` cleanup
4. Admin tables/forms — ongoing
5. Legacy CSS reduction до <1500 строк

## Visual regression baseline

```bash
npm run test:e2e:visual
```

Покрытие: home, registration, participants, brackets, admin login/registrations/brackets/bouts/survey, modals.
