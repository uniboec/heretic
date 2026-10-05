export const SYSTEM_LABELS: Record<string, string> = {
  champion: 'Чемпион',
  olympic: 'Олимпийская',
  round_robin: 'Круговая',
  three_way: 'Тройка с возвратом',
}

export const STATUS_REASON_LABELS: Record<string, string> = {
  NO_FORMAT_RULE: 'Нет правила формата для этого числа участников',
  EXCEEDS_MAX_PARTICIPANTS: 'Превышен максимум участников системы (32)',
  SYSTEM_UNAVAILABLE: 'Система сетки недоступна',
}

export const CATEGORY_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Активна',
  INACTIVE: 'Неактивна',
  UNSUPPORTED: 'Не поддерживается',
}

export const BRONZE_MODE_LABELS: Record<string, string> = {
  ONE: 'Один бой за 3-е',
  TWO: 'Две бронзы',
}

export const BRACKET_ACTION_LABELS = {
  syncAll: 'Синхронизировать',
  syncCategory: 'Синхронизировать категорию',
  redrawAll: 'Жеребьёвка',
  redrawAllStale: (count: number) => `Жеребьёвка (${count})`,
  redrawAllForce: 'Жеребьёвка всех',
  redrawCategory: 'Жеребьёвка',
  resetBrackets: 'Сброс',
  backup: 'Бэкап',
  createBackup: 'Создать копию',
  restoreBackup: 'Восстановить',
  forceRebuild: 'Пересобрать',
  consolidation: 'Автообъединение',
  showAllReady: 'Показать на сайте',
  hideAll: 'Скрыть с сайта',
  showCategoryOnSite: 'На сайт',
  hideCategoryFromSite: 'С сайта',
  releaseCategory: 'В расписание',
  unreleaseCategory: 'Из расписания',
  releaseAllReady: 'В расписание',
  unreleaseAll: 'Из расписания',
} as const

export const BRACKET_EXPORT_LABELS = {
  downloadCategoryPdf: 'Скачать PDF',
  downloadCategoryWord: 'Скачать Word',
  downloadAllPdf: 'Скачать все сетки (PDF)',
  downloadAllWord: 'Скачать все сетки (Word)',
  generating: 'Формирование…',
  errorDefault: 'Не удалось сформировать документ',
} as const

export const BRACKET_TOOLBAR_GROUP_LABELS = {
  sync: 'Заявки',
  redraw: 'Жеребьёвка',
  visibility: 'Сайт',
  boutsRelease: 'Расписание',
  service: 'Сервис',
} as const

export const BRACKET_WORKFLOW_STEPS = [
  {
    id: 'sync',
    label: 'Заявки',
    description: 'Синхронизация участников по заявкам',
  },
  {
    id: 'redraw',
    label: 'Жеребьёвка',
    description: 'Расстановка посева и балансировка',
  },
  {
    id: 'visibility',
    label: 'Сайт',
    description: 'Показ категорий на странице «Сетки»',
  },
  {
    id: 'boutsRelease',
    label: 'Расписание',
    description: 'Добавление категорий в расписание поединков',
  },
  {
    id: 'backup',
    label: 'Бэкап',
    description: 'Необязательный бэкап перед крупными изменениями',
    optional: true,
  },
] as const

export type BracketWorkflowStepId = (typeof BRACKET_WORKFLOW_STEPS)[number]['id']

export const BRACKET_SYNC_CONFIRM = {
  syncAllTitle: 'Синхронизировать все заявки?',
  syncAllBody:
    'Состав всех категорий будет пересобран по актуальным заявкам и выбранным критериям допуска.',
  syncAllBullets: [
    'Перенесённые вручную спортсмены вернутся в категории, указанные при регистрации.',
    'Ручные настройки системы проведения и бронзы в категориях сбросятся к автоматическим.',
    'Закреплённые позиции посева сохранятся. При необходимости выполните жеребьёвку.',
  ],
  syncCategoryTitle: 'Синхронизировать категорию?',
  syncCategoryBody:
    'Список участников в выбранной категории будет обновлён по заявкам. Переносы в другие категории и настройки остальных категорий не затрагиваются.',
  confirm: 'Синхронизировать',
  cancel: 'Отмена',
} as const

export const BRACKET_REDRAW_CONFIRM = {
  redrawAllTitle: 'Жеребьёвка устаревших категорий?',
  redrawAllBody:
    'Будет пересчитан посев и балансировка только в категориях с устаревшей жеребьёвкой или балансом. Операция может занять от нескольких секунд до нескольких минут — не закрывайте страницу.',
  redrawAllForceTitle: 'Жеребьёвка всех категорий?',
  redrawAllForceBody:
    'Будет пересчитан посев и балансировка во всех категориях, включая актуальные. Операция может занять от нескольких секунд до нескольких минут — не закрывайте страницу.',
  redrawAllBullets: [
    'Круговые системы (3 участника) не пережеребьёвываются — порядок там фиксирован.',
    'Для принудительной жеребьёвки одной категории используйте кнопку в карточке категории.',
    'Закреплённые позиции посева сохраняются.',
  ],
  confirm: 'Жеребьёвка',
  cancel: 'Отмена',
} as const

export const BRACKET_OPERATION_LABELS = {
  syncAll: 'Синхронизируем заявки…',
  syncCategory: 'Синхронизируем категорию…',
  redrawAll: 'Жеребьёвка устаревших категорий…',
  redrawAllForce: 'Жеребьёвка всех категорий…',
  redrawCategory: 'Жеребьёвка категории…',
  reset: 'Сбрасываем сетки…',
  backup: 'Создаём бэкап…',
  restoreBackup: 'Восстанавливаем из копии…',
  forceRebuild: 'Пересобираем категории…',
  consolidation: 'Применяем автообъединение…',
  settings: 'Обновляем критерии допуска…',
  hint: 'Это может занять несколько минут. Не закрывайте вкладку.',
} as const

export const BRACKET_IMPACT_CONFIRM = {
  resetTitle: 'Сбросить все сетки?',
  resetBody:
    'Все категории, посев и размещения будут удалены. Операция необратима без бэкапа.',
  forceRebuildTitle: 'Пересобрать категории?',
  forceRebuildBody:
    'Категории будут пересобраны по текущим заявкам. Расписание в затронутых категориях будет сброшено.',
  restoreTitle: 'Восстановить из бэкапа?',
  restoreBody:
    'Текущие данные сеток будут заменены содержимым выбранной копии. Затронутые категории показаны ниже.',
  settingsTitle: 'Изменить критерии допуска?',
  settingsBody:
    'Состав сеток будет пересобран по новым критериям. Категории в расписании могут потребовать подтверждения.',
  registrationTitle: 'Изменение затронет сетки',
  registrationBody:
    'Операция изменит состав категорий. Категории в расписании потребуют подтверждения.',
  consolidationTitle: 'Применить автообъединение?',
  consolidationBody:
    'Участники будут перенесены по правилам автообъединения. Затронутые категории будут пересобраны; расписание в RELEASED-категориях сбросится.',
  categoriesAffected: (affected: number, total: number) =>
    `Затронуто категорий: ${affected} из ${total}`,
  confirm: 'Подтвердить',
  confirmApply: 'Подтвердить и применить',
  cancel: 'Отмена',
  loading: 'Загрузка…',
} as const

export const BRACKET_LOCK_LEVEL_LABELS: Record<'OPEN' | 'RELEASED' | 'PLAYED', string> = {
  OPEN: 'Открыта',
  RELEASED: 'В поединках',
  PLAYED: 'Сыграна',
}

export const BRACKET_BACKUP_LABELS = {
  dialogTitle: 'Бэкап сеток',
  dialogBody: 'Создайте копию перед крупными изменениями или восстановите предыдущее состояние.',
  loading: 'Загружаем список копий…',
  empty: 'Бэкапов пока нет.',
  unnamedBackup: 'Копия без названия',
  categoryCount: (count: number) => `${count} кат.`,
  close: 'Закрыть',
  created: 'Бэкап создан',
  restored: 'Сетки восстановлены из бэкапа',
} as const

export const BRACKET_API_ERROR_LABELS: Record<string, string> = {
  Unauthorized: 'Требуется авторизация',
  INVALID_BODY: 'Некорректные данные запроса',
  NOT_FOUND: 'Раздел сеток недоступен',
  SERVER_ERROR: 'Ошибка сервера',
}

export const BRACKET_CONSOLIDATION_LABELS = {
  dialogTitle: 'Автообъединение',
  dialogDescription:
    'Настройте правила, проверьте предпросмотр и список спортсменов перед применением.',
  settingsSection: 'Автообъединение',
  settingsHint: 'Порог неполной категории и порядок волн объединения.',
  incompleteThreshold: 'Порог неполной категории',
  incompleteThresholdHint:
    'Категории с таким числом спортсменов (или меньше) будут кандидатами на объединение.',
  thresholdOption: (value: 1 | 2 | 3) =>
    value === 1
      ? '1 спортсмен — только одиночки'
      : value === 2
        ? '1–2 спортсмена'
        : '1–3 спортсмена',
  thresholdSelectedHint: (value: 1 | 2 | 3) =>
    value === 1
      ? 'Объединяются только категории с одним спортсменом.'
      : value === 2
        ? 'Объединяются категории с 1 или 2 спортсменами.'
        : 'Объединяются категории с 1, 2 или 3 спортсменами.',
  wavesTitle: 'Порядок волн',
  wavesHint:
    'Каждая волна обрабатывает все оставшиеся неполные категории, затем начинается следующая.',
  addWave: 'Добавить волну',
  preview: 'Предпросмотр',
  previewSection: 'Предпросмотр',
  previewHint: 'Сводка переносов по волнам после расчёта.',
  previewPlaceholder:
    'Настройте волны и нажмите «Предпросмотр», чтобы увидеть результат.',
  categoriesSection: 'Переносы категорий',
  categoriesHint: 'Из какой категории в какую будут перенесены спортсмены.',
  athletesSection: 'Спортсмены',
  athletesHint: 'Кто будет перенесён и в какие категории.',
  athleteColumn: 'Спортсмен',
  clubColumn: 'Клуб',
  fromColumn: 'Из категории',
  toColumn: 'В категорию',
  transferColumn: 'Перенос',
  apply: 'Применить',
  noMoves: 'Нет переносов по текущим правилам',
  movedCount: (count: number) => `Будет перенесено: ${count}`,
  traceTitle: 'Результаты по волнам',
  skippedTitle: 'Пропущено',
  waveLabel: (index: number) => `Волна ${index}`,
  actionsTitle: 'Действия в волне',
  addAction: 'Добавить действие',
  repeatLabel: 'Повтор',
  weightMappingLabel: 'Маппинг веса',
  finalTargetHint:
    'Сработает только если финальная категория уже содержит участников. Промежуточные ступени не проверяются.',
  presetExperienceWeight: 'Уровень + Вес',
  presetAgeWeight: 'Возраст + Вес',
  presetWeightX2: 'Вес ×2',
} as const

export const BRACKET_CONSOLIDATION_STEP_LABELS: Record<string, string> = {
  WEIGHT_UP: 'Вес ↑',
  WEIGHT_DOWN: 'Вес ↓',
  AGE_UP: 'Возраст ↑',
  EXPERIENCE_UP: 'Уровень ↑',
}

export const BRACKET_CONSOLIDATION_WEIGHT_MAPPING_LABELS: Record<string, string> = {
  SAME_INDEX: 'Тот же индекс',
  CLOSEST_KG: 'Ближайший кг',
}

export const BRACKET_CONSOLIDATION_VALIDATION_LABELS: Record<string, string> = {
  INVALID_ACTIONS_LENGTH: 'В волне должно быть от 1 до 3 действий',
  INVALID_ACTION_TYPE: 'Неизвестный тип действия',
  DUPLICATE_AXIS: 'Одна ось — одно действие; для повтора используйте «Повтор»',
  CONFLICTING_WEIGHT: 'Нельзя совмещать подъём и снижение веса в одной волне',
  INVALID_REPEAT: 'Недопустимое значение повтора',
}

export function formatConsolidationActionLabel(action: {
  type: string
  repeat?: number
}): string {
  const base = BRACKET_CONSOLIDATION_STEP_LABELS[action.type] ?? action.type
  if (action.repeat != null && action.repeat > 1) {
    return `${base} ×${action.repeat}`
  }
  return base
}

export function formatConsolidationWaveActions(
  actions: Array<{ type: string; repeat?: number }>,
): string {
  if (actions.length === 0) return '—'
  return actions.map((action) => formatConsolidationActionLabel(action)).join(' → ')
}

export const BRACKET_CONSOLIDATION_SKIP_LABELS: Record<string, string> = {
  SOURCE_NO_LONGER_INCOMPLETE: 'Источник больше не неполный',
  TARGET_EMPTY: 'Целевая категория пуста',
  TARGET_NOT_FOUND: 'Целевая категория не найдена',
  FORMAT_MAX_EXCEEDED: 'Превышен лимит формата',
  GROUP_INELIGIBLE: 'Группа не подходит',
  NO_CANDIDATE: 'Нет подходящей цели',
}

export const BRACKET_CONFLICT_CODE_LABELS: Record<string, string> = {
  VERSION_CONFLICT: 'Черновик изменён в другой вкладке. Обновите страницу.',
  DRAFT_ID_CONFLICT: 'Черновик не найден или уже опубликован. Обновите страницу.',
  IMPACT_CHANGED: 'Состав изменился — подтвердите операцию заново.',
  DESTRUCTIVE_CONFIRM_REQUIRED: 'Требуется подтверждение: операция затронет категории в поединках.',
  IMPACT_TOKEN_INVALID: 'Недействительный токен подтверждения.',
  IMPACT_TOKEN_EXPIRED: 'Токен подтверждения истёк — запросите preview заново.',
  CONSOLIDATION_PLAN_CHANGED: 'План автообъединения изменился — запросите preview заново.',
  CONSOLIDATION_POLICY_MISMATCH: 'Правила автообъединения не совпадают с preview.',
  CONSOLIDATION_PLAN_INVALID: 'Недействительный токен плана автообъединения.',
  CONSOLIDATION_DISABLED: 'Автообъединение отключено в настройках.',
}

export const BRACKET_WARNING_LABELS: Record<string, string> = {
  SYSTEM_OVERRIDE_CLEARED:
    'Сброшен ручной выбор системы (недопустим для нового числа участников)',
  BRONZE_OVERRIDE_CLEARED: 'Сброшен ручной выбор бронзы (недопустим для системы)',
}

export const BRACKET_VALIDATION_CODE_LABELS: Record<string, string> = {
  DRAFT_NOT_FOUND: 'Черновик не найден',
  DRAFT_STALE: 'Черновик устарел',
  UNSUPPORTED_CATEGORY: 'Категория не поддерживается',
  INVALID_ACTIVE_SYSTEM: 'Активная категория без системы проведения',
  INVALID_SYSTEM_FOR_N: 'Система недопустима для этого числа участников',
  EXCEEDS_MAX_PARTICIPANTS: 'Превышен лимит участников',
  SEEDING_STALE: 'Жеребьёвка устарела — выполните жеребьёвку',
  DUPLICATE_ENTRY: 'Участник в нескольких активных категориях',
  PLACEMENT_MISMATCH: 'Размещение участника не совпадает с сеткой',
  MISSING_SNAPSHOT_DATA: 'Нет данных для снимка участника',
  DUPLICATE_SEED: 'Дублирующиеся позиции посева',
  INVALID_SEED_RANGE: 'Позиция посева вне диапазона',
  GLOBAL_SYNC_REQUIRED: 'Сначала выполните обновление всего состава',
  NO_ELIGIBLE_ENTRIES:
    'Ни один спортсмен не подходит под текущие критерии допуска. Проверьте настройки «Включать оплаченных / неоплаченных» или статусы оплаты в заявках.',
  INVALID_ELIGIBILITY_SETTINGS:
    'Должен быть включён хотя бы один критерий допуска: оплаченные или неоплаченные.',
  ENTRY_NOT_FOUND: 'Участник не найден',
  TOO_FEW: 'Нужно минимум 2 участника',
  EXCEEDS_MAX: 'Превышен максимум участников',
  BRONZE_NOT_APPLICABLE: 'Бронза недоступна при менее 4 участниках',
  SYSTEM_UNAVAILABLE: 'Система сетки недоступна',
  RULE_SYSTEM_NOT_ALLOWED: 'Система по умолчанию должна быть в списке разрешённых',
  INVALID_RANGE: 'Минимум участников больше максимума',
  RULE_EXCEEDS_SYSTEM_MAX: 'Максимум по правилу превышает лимит системы',
  INVALID_BRONZE_MODE: 'Режим бронзы по умолчанию не поддерживается',
  OVERLAPPING_RANGES: 'Правила пересекаются по числу участников',
  INVALID_CHAMPION_RANGE: 'Система «Чемпион» допустима только для диапазона 1–1',
  RANGE_GAP: 'Есть пропуск в диапазонах числа участников',
  PUBLISH_VALIDATION_FAILED: 'Ошибка проверки перед публикацией',
  TOO_FEW_PARTICIPANTS: 'Недостаточно участников',
  AUDIT_NOT_FOUND: 'Запись истории переноса не найдена',
  UNDO_NOT_LATEST: 'Можно отменить только последнее действие по этому участнику',
  UNDO_STATE_MISMATCH: 'Текущее размещение участника не совпадает с записью в истории',
}

export const BRACKET_MOVE_ACTION_LABELS: Record<string, string> = {
  MOVE: 'Перенос',
  RESET: 'Возврат авто',
  CONSOLIDATION: 'Автообъединение',
}

export const BRACKET_PARTICIPANT_ACTION_LABELS = {
  lock: 'Закрепить',
  unlock: 'Открепить',
  move: 'Перенести',
  resetPlacement: 'Вернуть авто',
  confirmMove: 'Перенести',
  cancel: 'Отмена',
  undoMove: 'Откат',
} as const

export const BRACKET_SETTINGS_ACTION_LABELS = {
  save: 'Сохранить',
  saveEligibility: 'Сохранить допуск',
} as const

export const BRACKET_FORMAT_RULES_ACTION_LABELS = {
  add: 'Добавить',
  save: 'Сохранить',
} as const

function hasCyrillic(text: string): boolean {
  return /[а-яА-ЯёЁ]/.test(text)
}

/** Единая подпись поединка во всех системах сеток. */
export function formatBoutLabel(boutNumber: number): string {
  return `Бой ${boutNumber}`
}

export function formatBoutWinnerHint(boutNumber: number | string): string {
  return `Победитель боя ${boutNumber}`
}

export function formatBoutLoserHint(boutNumber: number | string): string {
  return `Проигравший боя ${boutNumber}`
}

export function formatOlympicBoutLabel(boutNumber: number): string {
  return formatBoutLabel(boutNumber)
}

const PUBLIC_SYSTEM_LABELS_WITH_SUFFIX = new Set(['olympic', 'round_robin'])

export function formatPublicSystemLabel(systemId: string | null | undefined): string {
  if (!systemId) return '—'
  const base = SYSTEM_LABELS[systemId] ?? 'Неизвестная система'
  if (PUBLIC_SYSTEM_LABELS_WITH_SUFFIX.has(systemId)) {
    return `${base} система`
  }
  return base
}

export function formatPublicBracketCategoryMeta(
  participantCount: number,
  systemId: string | null | undefined,
): string {
  return [
    formatParticipantCount(participantCount),
    systemId ? formatPublicSystemLabel(systemId) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function formatParticipantCount(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} участник`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} участника`
  return `${count} участников`
}

export function formatSystemLabel(systemId: string | null | undefined): string {
  if (!systemId) return '—'
  return SYSTEM_LABELS[systemId] ?? 'Неизвестная система'
}

export function formatBronzeModeLabel(mode: string | null | undefined): string {
  if (!mode) return '—'
  return BRONZE_MODE_LABELS[mode] ?? '—'
}

export function formatCategoryStatusLabel(status: string): string {
  return CATEGORY_STATUS_LABELS[status] ?? 'Неизвестный статус'
}

export function formatFormatRuleLabel(systemId: string, bronzeMode?: string | null): string {
  const system = formatSystemLabel(systemId)
  if (!bronzeMode) return system
  return `${system}, ${formatBronzeModeLabel(bronzeMode)}`
}

export function formatAllowedSystemIds(systemIds: string[]): string {
  return systemIds.map((id) => formatSystemLabel(id)).join(', ')
}

export function formatStatusReasonLabel(reason: string | null | undefined): string {
  if (!reason) return ''
  return (
    STATUS_REASON_LABELS[reason] ??
    BRACKET_VALIDATION_CODE_LABELS[reason] ??
    'Причина не указана'
  )
}

export function formatBracketApiError(error: string | null | undefined): string {
  if (!error) return 'Ошибка операции'
  const mapped = BRACKET_API_ERROR_LABELS[error]
  if (mapped) return mapped
  if (hasCyrillic(error)) return error
  return 'Ошибка операции'
}

export function formatBracketWarningLabel(code: string): string {
  return (
    BRACKET_WARNING_LABELS[code] ??
    BRACKET_VALIDATION_CODE_LABELS[code] ??
    'Неизвестное предупреждение'
  )
}

export function formatBracketConflictMessage(code: string | null | undefined): string {
  if (!code) return 'Конфликт черновика. Обновите страницу.'
  return BRACKET_CONFLICT_CODE_LABELS[code] ?? 'Конфликт черновика. Обновите страницу.'
}

export function formatValidationIssueMessage(issue: {
  code: string
  message?: string
}): string {
  if (issue.message && hasCyrillic(issue.message)) return issue.message
  return BRACKET_VALIDATION_CODE_LABELS[issue.code] ?? 'Ошибка операции'
}
