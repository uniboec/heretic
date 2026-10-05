export class DraftConflictError extends Error {
  code = 'DRAFT_ID_CONFLICT'
  constructor(message = 'Черновик не найден или не в статусе «Черновик»') {
    super(message)
    this.name = 'DraftConflictError'
  }
}

export class VersionConflictError extends Error {
  code = 'VERSION_CONFLICT'
  constructor(message = 'Версия черновика не совпадает') {
    super(message)
    this.name = 'VersionConflictError'
  }
}

export class PublishValidationError extends Error {
  code = 'PUBLISH_VALIDATION_FAILED'
  errors: Array<{ code: string; message: string; categoryKey?: string }>
  constructor(errors: Array<{ code: string; message: string; categoryKey?: string }>) {
    super('Ошибка проверки перед публикацией')
    this.name = 'PublishValidationError'
    this.errors = errors
  }
}

export class BracketOperationError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'BracketOperationError'
    this.code = code
  }
}

export function isSerializationFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2034'
  )
}
