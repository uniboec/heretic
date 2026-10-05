export class BoutsConfigurationError extends Error {
  code = 'BOUTS_CONFIGURATION_ERROR'
  constructor(message: string) {
    super(message)
    this.name = 'BoutsConfigurationError'
  }
}

export class BoutsPageSettingMissingError extends Error {
  code = 'BOUTS_PAGE_SETTING_MISSING'
  constructor(message = 'BoutsPageSetting(id=default) отсутствует — повреждение инфраструктурного инварианта') {
    super(message)
    this.name = 'BoutsPageSettingMissingError'
  }
}

export class BoutsValidationError extends Error {
  code = 'BOUTS_VALIDATION_ERROR'
  constructor(message: string) {
    super(message)
    this.name = 'BoutsValidationError'
  }
}

export class MatCountDemotionConfirmationRequiredError extends Error {
  code = 'MAT_COUNT_DEMOTION_CONFIRMATION_REQUIRED'
  demotionToken: string
  demotedFixedMats: number[]
  demotedCategoryCount: number
  draftEntries: Array<{ categoryKey: string; matIndex: number }>
  publishedEntries: Array<{ categoryKey: string; matIndex: number }>

  constructor(input: {
    demotionToken: string
    demotedFixedMats: number[]
    demotedCategoryCount: number
    draftEntries: Array<{ categoryKey: string; matIndex: number }>
    publishedEntries: Array<{ categoryKey: string; matIndex: number }>
  }) {
    super('Требуется подтверждение перевода Fixed-категорий в Auto')
    this.name = 'MatCountDemotionConfirmationRequiredError'
    this.demotionToken = input.demotionToken
    this.demotedFixedMats = input.demotedFixedMats
    this.demotedCategoryCount = input.demotedCategoryCount
    this.draftEntries = input.draftEntries
    this.publishedEntries = input.publishedEntries
  }
}

export class BoutsSchedulerError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'BoutsSchedulerError'
    this.code = code
  }
}

export class BoutNotReadyError extends BoutsSchedulerError {
  constructor(message = 'Поединок ещё не готов к началу') {
    super('BOUT_NOT_READY', message)
    this.name = 'BoutNotReadyError'
  }
}

export class BoutAlreadyInProgressError extends BoutsSchedulerError {
  constructor(message = 'На площадке уже идёт другой поединок') {
    super('BOUT_ALREADY_IN_PROGRESS', message)
    this.name = 'BoutAlreadyInProgressError'
  }
}

export class BoutExecutionOutOfOrderError extends BoutsSchedulerError {
  constructor(message = 'Завершение поединка вне допустимого порядка') {
    super('BOUT_EXECUTION_OUT_OF_ORDER', message)
    this.name = 'BoutExecutionOutOfOrderError'
  }
}

export class UndoWhileBoutInProgressError extends BoutsSchedulerError {
  constructor(message = 'Отмена завершения недоступна, пока идёт поединок') {
    super('UNDO_WHILE_BOUT_IN_PROGRESS', message)
    this.name = 'UndoWhileBoutInProgressError'
  }
}

export class TimingSettingsFrozenError extends BoutsSchedulerError {
  constructor(message = 'Настройки времени заморожены после начала турнира') {
    super('TIMING_SETTINGS_FROZEN', message)
    this.name = 'TimingSettingsFrozenError'
  }
}

export class BoutAssignmentFrozenError extends BoutsSchedulerError {
  constructor(message = 'Нельзя уменьшить число площадок после начала боёв на удаляемой площадке') {
    super('BOUT_ASSIGNMENT_FROZEN', message)
    this.name = 'BoutAssignmentFrozenError'
  }
}

export class InvalidBoutExecutionStateError extends BoutsSchedulerError {
  constructor(reason: string) {
    super('INVALID_BOUT_EXECUTION_STATE', reason)
    this.name = 'InvalidBoutExecutionStateError'
  }
}

export class BoutsScheduleCorruptError extends BoutsSchedulerError {
  constructor(reason: string) {
    super('BOUTS_SCHEDULE_CORRUPT', reason)
    this.name = 'BoutsScheduleCorruptError'
  }
}

export class ScheduleConstraintCycleError extends BoutsSchedulerError {
  constructor(message: string) {
    super('SCHEDULE_CONSTRAINT_CYCLE', message)
    this.name = 'ScheduleConstraintCycleError'
  }
}

export class UnsatisfiableScheduleError extends BoutsSchedulerError {
  constructor(message = 'Невозможно построить расписание с текущими ограничениями') {
    super('UNSCHEDULABLE_CONSTRAINTS', message)
    this.name = 'UnsatisfiableScheduleError'
  }
}

export class InvalidScheduleInvariantError extends BoutsSchedulerError {
  constructor(message: string) {
    super('INVALID_SCHEDULE_INVARIANT', message)
    this.name = 'InvalidScheduleInvariantError'
  }
}

export class InvalidScheduleReorderError extends BoutsSchedulerError {
  constructor(message = 'Перестановка между этапами не допускается') {
    super('INVALID_SCHEDULE_REORDER', message)
    this.name = 'InvalidScheduleReorderError'
  }
}

export class StageSettingsLockedError extends BoutsSchedulerError {
  constructor(message = 'Настройки этапа заблокированы после начала проведения') {
    super('STAGE_SETTINGS_LOCKED', message)
    this.name = 'StageSettingsLockedError'
  }
}

export class CompetitionStageChangeForbiddenError extends BoutsSchedulerError {
  constructor(message = 'Нельзя изменить этап категории') {
    super('COMPETITION_STAGE_CHANGE_FORBIDDEN', message)
    this.name = 'CompetitionStageChangeForbiddenError'
  }
}

export class BoutNotNextInScheduleError extends BoutsSchedulerError {
  constructor(message = 'Поединок не является следующим в расписании') {
    super('BOUT_NOT_NEXT_IN_SCHEDULE', message)
    this.name = 'BoutNotNextInScheduleError'
  }
}

export class ScheduleVersionConflictError extends BoutsSchedulerError {
  constructor(message = 'Версия расписания устарела') {
    super('SCHEDULE_VERSION_CONFLICT', message)
    this.name = 'ScheduleVersionConflictError'
  }
}

export class MutationIdPayloadMismatchError extends BoutsSchedulerError {
  constructor(message = 'mutationId уже использован с другим payload') {
    super('MUTATION_ID_PAYLOAD_MISMATCH', message)
    this.name = 'MutationIdPayloadMismatchError'
  }
}

export class ScheduleNumberConflictError extends BoutsSchedulerError {
  constructor(message = 'Номер расписания уже занят') {
    super('SCHEDULE_NUMBER_CONFLICT', message)
    this.name = 'ScheduleNumberConflictError'
  }
}

export class ScheduleContiguityConflictError extends BoutsSchedulerError {
  constructor(message = 'Нарушена непрерывность номеров расписания') {
    super('SCHEDULE_CONTIGUITY_CONFLICT', message)
    this.name = 'ScheduleContiguityConflictError'
  }
}

export class ScheduleStructuralMutationBlockedError extends BoutsSchedulerError {
  constructor(message = 'Структурные изменения расписания заблокированы (legacyGap)') {
    super('SCHEDULE_STRUCTURAL_MUTATION_BLOCKED', message)
    this.name = 'ScheduleStructuralMutationBlockedError'
  }
}

export class ScheduleMutationPendingError extends BoutsSchedulerError {
  constructor(message = 'Операция расписания ещё выполняется') {
    super('SCHEDULE_MUTATION_PENDING', message)
    this.name = 'ScheduleMutationPendingError'
  }
}

export class PinCascadeConfirmationRequiredError extends Error {
  code = 'PIN_CASCADE_CONFIRMATION_REQUIRED'
  cascadeBoutIds: string[]

  constructor(cascadeBoutIds: string[]) {
    super('Закрепление затронет зависимые поединки в сетке')
    this.name = 'PinCascadeConfirmationRequiredError'
    this.cascadeBoutIds = cascadeBoutIds
  }
}
