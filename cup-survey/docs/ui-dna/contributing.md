# UI DNA — правила внесения изменений

## Порядок при добавлении UI

1. Проверить существующие `components/ui` primitives и canonical tokens в `@theme`.
2. Собрать layout из domain patterns (`@layer domains`) только если primitives недостаточно.
3. Новый цвет или размер — только через `@theme` в [`app/globals.css`](../../app/globals.css).

## Запрещено

- Параллельные наборы токенов (`--ds-*`, новые `--event-*`, `--bracket-*`).
- Tailwind default palette (`red-*`, `slate-*`, `gray-*`, `blue-*` и т.д.) — только DNA utilities (`text-danger`, `bg-warning-soft`, …).
- Hardcoded hex в domain/legacy CSS (допустим только в top-level `@theme`).
- Глобальные селекторы `button`, `input`, `select`, `textarea` в domain CSS.
- Unlayered legacy CSS — только `@layer legacy` или `@layer domains`.

## Обязательно перед PR со стилями

```bash
npm run ui-debt
npm run test:e2e:visual
npm run lint:css
```

## Цикл миграции блока

```
baseline → primitives/tokens → удаление legacy CSS → scoreboard → visual regression
```

Один PR = один-два логических блока, не переписывание всего CSS-файла.
