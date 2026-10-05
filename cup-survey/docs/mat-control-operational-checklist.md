# Mat-control operational checklist

Чеклист для судей и администраторов перед/во время турнира (Tournament Reliability v9).

## Перед началом смены

- [ ] Открыто **одно** окно mat-control на ковёр (вторая вкладка блокируется tab-lock).
- [ ] Захвачен lease ковра (зелёный индикатор в service bar).
- [ ] Сеть стабильна; при offline команды пишутся в WAL и отправляются при `online`.
- [ ] Звук таймера включён и громкость проверена.
- [ ] Публичное табло (`/scoreboard/{mat}`) открыто на отдельном экране; при необходимости — «Установить приложение» (PWA).

## Начало боя

- [ ] Сессия боя (`bout session`) acquired автоматически при открытии поединка.
- [ ] Нет предупреждения **«Сессия боя устаревшая»** (stale). Если есть — админ делает handoff.
- [ ] Первый вызов спортсменов и старт часов — по регламенту (mandate confirm при необходимости).

## Во время боя

- [ ] Прямой счёт (technical score) без хронологии требует `adminOverrideReason`.
- [ ] Confirm блокируется при validation issues (часы, injury+score и т.д.).
- [ ] При потере связи — не закрывать вкладку до восстановления sync / commit.

## Завершение боя

- [ ] Подтверждение результата через **commit package** (reliability path) или legacy CONFIRM.
- [ ] Статусы lifecycle: `FINISHED_LOCALLY` → `PENDING_SYNC` → `COMMITTED_LOCAL`.
- [ ] При `PENDING_SYNC` — кнопка «Повторить commit» или автоматически при восстановлении сети.

## После смены / инцидент

- [ ] Админ: **Аудит mat-control** (`/admin/bouts/audit`) — открытые findings.
- [ ] Админ: **Сверка mat-control** (`/admin/bouts/reconciliation`) — mismatch результат/сетка.
- [ ] При mismatch — коррекция результата или bracket fix; backfill `fightOfficiallyStarted` при необходимости.
- [ ] Takeover / handoff задокументирован в ownership log.

## Эскалация

| Симптом | Действие |
|--------|----------|
| `SESSION_SUPERSEDED` | Handoff сессии админом |
| Stale session (heartbeat timeout) | Handoff или Reclaim (EXPIRED) |
| `EXPECTED_SEQUENCE` | Обновить экран; не дублировать команды |
| `BOUT_ALREADY_COMMITTED` | Не повторять commit; проверить результат в сетке |
| Двойной победитель в сетке | Reconciliation dashboard + correction workflow |
