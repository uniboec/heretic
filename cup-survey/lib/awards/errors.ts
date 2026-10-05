export class AwardsPageSettingMissingError extends Error {
  readonly code = 'AWARDS_SETTINGS_MISSING'

  constructor() {
    super('Awards page settings are not configured')
    this.name = 'AwardsPageSettingMissingError'
  }
}

export class AwardsOperationError extends Error {
  readonly code: string
  readonly httpStatus: number

  constructor(code: string, message: string, httpStatus = 409) {
    super(message)
    this.name = 'AwardsOperationError'
    this.code = code
    this.httpStatus = httpStatus
  }
}

export class RevisionConflictError extends AwardsOperationError {
  constructor() {
    super('REVISION_CONFLICT', 'Category revision conflict')
  }
}

export class QueueRevisionConflictError extends AwardsOperationError {
  constructor() {
    super('QUEUE_REVISION_CONFLICT', 'Queue revision conflict')
  }
}

export class CeremonyAlreadyInProgressError extends AwardsOperationError {
  constructor() {
    super('CEREMONY_ALREADY_IN_PROGRESS', 'Another ceremony is already in progress')
  }
}

export class IdempotencyKeyReusedError extends AwardsOperationError {
  constructor() {
    super('IDEMPOTENCY_KEY_REUSED', 'Operation id was reused with a different payload')
  }
}

export class OperationInProgressError extends AwardsOperationError {
  constructor() {
    super('OPERATION_IN_PROGRESS', 'Operation is still in progress')
  }
}

export class PlacementNotFoundError extends AwardsOperationError {
  constructor() {
    super('PLACEMENT_NOT_FOUND', 'Placement not found', 404)
  }
}
