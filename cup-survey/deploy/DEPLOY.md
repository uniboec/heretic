# Деплой cup-survey (zero-downtime blue-green)

Production: https://cup26.mma66.ru

## Архитектура

| Компонент | Назначение |
|-----------|------------|
| `app-blue` | Слот на порту 3001 |
| `app-green` | Слот на порту 3002 |
| `/etc/nginx/snippets/cup-survey-upstream.conf` | Активный upstream (переключается без простоя) |
| `/opt/cup-survey-shared/deploy-state.json` | Активный слот, image id, traffic status |
| `/opt/cup-survey-shared/pending-switch.json` | Journal незавершённой транзакции |
| `/opt/cup-survey-shared/compose-images.env` | Производный кэш `CUP_BLUE_IMAGE` / `CUP_GREEN_IMAGE` |

Migrate выполняется **вне Compose**: `docker run cup-survey-migrate:<release-tag>`.

## Первый запуск (legacy → blue-green)

1. Установить проект и legacy `app` на :3001 (см. `vps-setup.sh`).
2. Скопировать nginx snippet: `cp deploy/snippets/cup-survey-upstream.conf /etc/nginx/snippets/`
3. Обновить site config: `cp deploy/nginx-cup26.mma66.ru.conf /etc/nginx/sites-available/cup26.mma66.ru`
4. В непиковое время выполнить bootstrap:

```bash
cd /opt/cup-survey
./deploy/bootstrap-blue-green.sh
```

Bootstrap: backup DB → build candidate → migrate → journal → `app-green` → smoke → nginx switch → commit state → observe → stop legacy.

После bootstrap используйте только `release-app.sh`.

## Обычный релиз

```bash
cd /opt/cup-survey
git pull   # или rsync; working tree должен быть clean
./deploy/release-app.sh
```

Pipeline: reconcile → prevalidate → build (immutable git archive) → merge static → migration check → journal → inactive slot → pre-switch smoke → nginx switch → commit state → public smoke → observe → cleanup.

## Ручной откат

```bash
./deploy/cup-survey-rollback.sh
```

Reverse blue-green deploy (не nginx-only). Работает только если `previous_manual_rollback_compatible=true`.

## Миграции

### Безопасные (expand-contract)

- Добавление nullable колонок, новых таблиц, индексов CONCURRENTLY — деплой через `release-app.sh`.
- `check-migration-status.sh`: `UP_TO_DATE` | `PENDING` | `BROKEN`.
- Перед `PENDING` миграциями — обязательный `backup-postgres.sh`.

### Destructive

Отдельный workflow (не штатный rollback):

```bash
./deploy/cup-survey-destructive-migrate.sh path/to/destructive.sql
```

Скрипт: backup → `previous_manual_rollback_compatible=false` → SQL.

## RPO / восстановление БД

| Сценарий | Стратегия |
|----------|-----------|
| Code-only deploy | Rollback = nginx switch (RPO = 0 для кода) |
| Safe schema migration | expand-contract + pre-deploy dump |
| Destructive migration | maintenance window или PITR (вне scope) |
| Failed migration | Restore из dump — **аварийное** средство |

Штатный откат приложения — `cup-survey-rollback.sh` (previous image). DB restore — только когда app rollback не помогает.

Проверка backup на staging:

```bash
./deploy/restore-drill.sh
```

## Auto mat BY_CATEGORY (Phase 1 → Phase 2 → Phase 3)

Трёхфазный cutover для `autoMatAssignMode` / `autoMatByCategoryEnabled`. Marker **не** включается через PATCH или env.

### Phase 1 (по умолчанию после migrate)

- Migration `20260925140000_auto_mat_assign_mode`: enum, колонки, singleton `id='default'` (`BY_BOUT`, `marker=false`)
- Rolling deploy нового кода
- Release Auto → effective mode **BY_BOUT** (per-bout)
- PATCH `BY_CATEGORY` → **400** (`AUTO_MAT_BY_CATEGORY_NOT_ENABLED`)
- Admin toggle disabled (`autoMatByCategoryEnabled=false`)

### Phase 2 — marker cutover (ops, один раз на окружение)

После исчезновения pre-cutover инстансов:

```bash
npm run enable-auto-mat-by-category
# или на VPS one-off:
# npx tsx scripts/enable-auto-mat-by-category.ts
```

Скрипт: `FOR UPDATE` + conditional `UPDATE` (`mode=BY_BOUT`, `marker=false` → `marker=true`).  
`affectedRows !== 1` → abort (exit ≠ 0). **`updatedAt` не меняется** (rollout metadata).

После cutover: PATCH/UI toggle активен. Рабочий режим BY_CATEGORY — через admin PATCH `BY_BOUT→BY_CATEGORY` → Auto unrelease → re-release.

### Phase 3 — schema default (отдельный deploy после Phase 2 в production)

Migration `20260925150000_auto_mat_assign_mode_phase3`: `ALTER COLUMN ... SET DEFAULT 'BY_CATEGORY'`.  
**Без** `UPDATE` существующего singleton. Активный mode меняется только admin PATCH.

### Fresh install / новое окружение

После `prisma migrate deploy` (все migrations, включая Phase 3) singleton остаётся:

```
autoMatAssignMode = BY_BOUT
autoMatByCategoryEnabled = false
```

**Обязательно один раз** выполнить:

```bash
npm run enable-auto-mat-by-category
```

До cutover toggle BY_CATEGORY в admin недоступен; release работает как BY_BOUT.

### Infrastructure invariant

Отсутствие `BoutsPageSetting(id='default')` — **infrastructure error** на всех read/write paths (GET settings → 5xx, `lockBoutsPageSetting` → throw). Без fallback defaults и без production upsert-create.

## Bouts release (Phase 1 → Phase 2)

Двухфазный cutover для `visible` / `boutsReleased` (план v2.6). **Не включать** startup reconciliation `visible=true AND boutsReleased=false → sync`.

### Phase 1 (по умолчанию)

- `INDEPENDENT_BOUTS_RELEASE` **не задан** или не `true`/`1`
- «Показать на сайте» dual-write: `visible` + legacy gate для `boutsReleased`
- `/bouts` читает `visible`

### Phase 2

1. Schema migration уже в репозитории (`20260925120000_bouts_release_state`)
2. Deploy Phase-1 dual-write code на **все** инстансы
3. Дождаться исчезновения pre-Phase-1 инстансов
4. Backfill:

```bash
npm run backfill:bouts-release
# или на VPS внутри migrate-контейнера / one-off:
# npx tsx scripts/backfill-bouts-release-state.ts
```

5. Проверить инварианты (integration tests `boutsRelease.integration.test.ts`)
6. В `.env` production: `INDEPENDENT_BOUTS_RELEASE=true`, redeploy
7. Организатор: снимок → «Показать на сайте» → **«Выпустить готовые в поединки»** (шаг 5 toolbar)

При Phase 2 Auto распределяется two-pass (Fixed → Auto); `/bouts` читает `boutsReleased`.

## Preflight

`check-deploy-resources.sh` перед build:

| Gate | Default | Переменная |
|------|---------|------------|
| RAM (incremental) | build 2048 + app 512 + buffer 512 MB | `BUILD_PEAK_MB`, `NEW_APP_MB`, `BUFFER_MB` |
| Disk free | ≥ 8 GB on `/` | `DISK_GATE_GB` |
| CPU load | load₁ₘ ≤ cores × 2 | `CPU_LOAD_FACTOR` |
| Swap used | ≤ 512 MB | `SWAP_USED_MAX_MB` |
| DB connections headroom | ≥ 20 | — |

Дополнительно:

- `ensure-clean-git.sh` — abort при dirty tree
- `verify-migrate-image-labels.sh` — app/migrate OCI labels must match
- `manifest_gate.py` — reconcile блокирует deploy при manifest/state mismatch
- `flock` на `/opt/cup-survey-shared/deploy.lock`
- `MIGRATE_TIMEOUT_SEC` (default 300) для `prisma migrate deploy`

## Staging checklist

Автоматизируемая часть (на staging VPS):

```bash
./deploy/staging-validation.sh
```

Ручные сценарии (см. план, этап 9):

1. Bootstrap end-to-end + crash/restart recovery
2. 5 последовательных `release-app.sh`
3. Rollback до и после switch (`cup-survey-rollback.sh`)
4. `restore-drill.sh`
5. Partial rollback recovery (public=previous, state=target)
6. Concurrent deploy → flock blocked
7. Resource preflight abort при нехватке RAM
8. Load test (`hey -z 120s -c 10`) во время switch

## Полезные команды

```bash
./deploy/reconcile-deploy-state.sh      # вручную (обычно вызывается из release-app)
./deploy/cup-survey-finish-cleanup.sh   # дочистить pending cleanup
./deploy/network-transition.sh          # external network cup-survey-prod
```

## URL

- Опрос: https://cup26.mma66.ru/
- Админка: https://cup26.mma66.ru/admin
- Health: `/api/health` (read-only)
- Build identity: `/api/build-info` (`releaseId`, `gitSha`)
