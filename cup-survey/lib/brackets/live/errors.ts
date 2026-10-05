import { BracketOperationError } from '../core/errors'

export class LiveGenerationMissingError extends BracketOperationError {
  constructor() {
    super('LIVE_GENERATION_MISSING', 'Боевое поколение сеток не найдено')
  }
}

export class ImpactChangedError extends BracketOperationError {
  constructor(
    public readonly actualImpact: {
      affectedCategoryKeys: string[]
      lockLevels: Record<string, string>
    },
  ) {
    super('IMPACT_CHANGED', 'Состав изменился — подтвердите операцию заново')
  }
}

export class ImpactTokenInvalidError extends BracketOperationError {
  constructor(message = 'Недействительный токен подтверждения') {
    super('IMPACT_TOKEN_INVALID', message)
  }
}

export class ImpactTokenExpiredError extends BracketOperationError {
  constructor() {
    super('IMPACT_TOKEN_EXPIRED', 'Токен подтверждения истёк — запросите preview заново')
  }
}

export class DestructiveConfirmRequiredError extends BracketOperationError {
  constructor() {
    super('DESTRUCTIVE_CONFIRM_REQUIRED', 'Требуется подтверждение destructive-операции')
  }
}

export class SettingsChangeBlockedError extends BracketOperationError {
  constructor() {
    super('SETTINGS_CHANGE_BLOCKED', 'Изменение критериев затронет категории в поединках')
  }
}
