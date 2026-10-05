export class MatControlError extends Error {
  readonly code: string
  readonly httpStatus: number

  constructor(code: string, message: string, httpStatus = 409) {
    super(message)
    this.name = 'MatControlError'
    this.code = code
    this.httpStatus = httpStatus
  }
}

export class CommandNotAllowedError extends MatControlError {
  constructor(message = 'Команда недоступна в текущей фазе боя') {
    super('COMMAND_NOT_ALLOWED', message)
    this.name = 'CommandNotAllowedError'
  }
}

export class CornerSwapNotAllowedError extends MatControlError {
  constructor(message = 'Смена углов недоступна после первого вызова спортсменов') {
    super('CORNER_SWAP_NOT_ALLOWED', message)
    this.name = 'CornerSwapNotAllowedError'
  }
}

export class FirstCallOrderViolationError extends MatControlError {
  constructor(message = 'Сначала вызовите красного угол') {
    super('FIRST_CALL_ORDER_VIOLATION', message)
    this.name = 'FirstCallOrderViolationError'
  }
}

export class FirstCallAlreadyRecordedError extends MatControlError {
  constructor(message = 'Первоначальный вызов этого спортсмена уже зафиксирован') {
    super('FIRST_CALL_ALREADY_RECORDED', message)
    this.name = 'FirstCallAlreadyRecordedError'
  }
}

export class SecondaryCallWithoutFirstError extends MatControlError {
  constructor(message = 'Вторичный вызов возможен только после первоначального вызова') {
    super('SECONDARY_CALL_WITHOUT_FIRST', message)
    this.name = 'SecondaryCallWithoutFirstError'
  }
}

export class BothFirstCallsRequiredError extends MatControlError {
  constructor(message = 'Сначала вызовите обоих спортсменов') {
    super('BOTH_FIRST_CALLS_REQUIRED', message)
    this.name = 'BothFirstCallsRequiredError'
  }
}

export class SecondaryCallAlreadyRecordedError extends MatControlError {
  constructor(message = 'Вторичный вызов этого спортсмена уже активен') {
    super('SECONDARY_CALL_ALREADY_RECORDED', message)
    this.name = 'SecondaryCallAlreadyRecordedError'
  }
}

export class NoShowNotAllowedError extends MatControlError {
  constructor(message = 'Неявку нельзя зафиксировать до вторичного вызова') {
    super('NO_SHOW_NOT_ALLOWED', message)
    this.name = 'NoShowNotAllowedError'
  }
}

export class SecondaryCallTimerActiveError extends MatControlError {
  constructor(message = 'Неявку можно зафиксировать только после истечения 120 секунд') {
    super('SECONDARY_CALL_TIMER_ACTIVE', message)
    this.name = 'SecondaryCallTimerActiveError'
  }
}

export class AthleteWaitAlreadyActiveError extends MatControlError {
  constructor(message = 'Ожидание этого спортсмена уже начато') {
    super('ATHLETE_WAIT_ALREADY_ACTIVE', message)
    this.name = 'AthleteWaitAlreadyActiveError'
  }
}

export class AthleteWaitNotActiveError extends MatControlError {
  constructor(message = 'Отсчёт ожидания этого спортсмена не запущен') {
    super('ATHLETE_WAIT_NOT_ACTIVE', message)
    this.name = 'AthleteWaitNotActiveError'
  }
}

export class AthleteDoctorAlreadyActiveError extends MatControlError {
  constructor(message = 'Отсчёт времени у врача для этого спортсмена уже запущен') {
    super('ATHLETE_DOCTOR_ALREADY_ACTIVE', message)
    this.name = 'AthleteDoctorAlreadyActiveError'
  }
}

export class AthleteDoctorNotActiveError extends MatControlError {
  constructor(message = 'Отсчёт времени у врача для этого спортсмена не запущен') {
    super('ATHLETE_DOCTOR_NOT_ACTIVE', message)
    this.name = 'AthleteDoctorNotActiveError'
  }
}

export class DoctorRemovalNotAllowedError extends MatControlError {
  constructor(message = 'Снятие врачом доступно после 2 минут у врача') {
    super('DOCTOR_REMOVAL_NOT_ALLOWED', message)
    this.name = 'DoctorRemovalNotAllowedError'
  }
}

export class AthleteEquipmentAlreadyActiveError extends MatControlError {
  constructor(message = 'Отсчёт времени на исправление экипировки уже запущен') {
    super('ATHLETE_EQUIPMENT_ALREADY_ACTIVE', message)
    this.name = 'AthleteEquipmentAlreadyActiveError'
  }
}

export class AthleteEquipmentNotActiveError extends MatControlError {
  constructor(message = 'Отсчёт времени на исправление экипировки не запущен') {
    super('ATHLETE_EQUIPMENT_NOT_ACTIVE', message)
    this.name = 'AthleteEquipmentNotActiveError'
  }
}

export class EquipmentDisqualifyNotAllowedError extends MatControlError {
  constructor(message = 'Дисквалификация за экипировку доступна после 2 минут') {
    super('EQUIPMENT_DISQUALIFY_NOT_ALLOWED', message)
    this.name = 'EquipmentDisqualifyNotAllowedError'
  }
}

export class LeaseNotHeldError extends MatControlError {
  constructor(message = 'Управление ковром не захвачено') {
    super('LEASE_NOT_HELD', message, 403)
    this.name = 'LeaseNotHeldError'
  }
}

export class LeaseStaleError extends MatControlError {
  constructor(message = 'Сессия управления ковром устарела') {
    super('LEASE_STALE', message)
    this.name = 'LeaseStaleError'
  }
}

export class AttemptMismatchError extends MatControlError {
  constructor(message = 'Устаревший номер попытки проведения боя') {
    super('ATTEMPT_MISMATCH', message)
    this.name = 'AttemptMismatchError'
  }
}

export class StaleLiveRevisionError extends MatControlError {
  constructor(message = 'Состояние боя изменилось — обновите экран') {
    super('STALE_LIVE_REVISION', message)
    this.name = 'StaleLiveRevisionError'
  }
}

export class IdempotencyKeyReusedError extends MatControlError {
  constructor(message = 'operationId уже использован с другим payload') {
    super('IDEMPOTENCY_KEY_REUSED', message)
    this.name = 'IdempotencyKeyReusedError'
  }
}

export class NotActiveBoutError extends MatControlError {
  constructor(message = 'Поединок не является активным на ковре') {
    super('NOT_ACTIVE_BOUT', message)
    this.name = 'NotActiveBoutError'
  }
}

export class ActiveBoutConflictError extends MatControlError {
  constructor(message = 'На ковре уже идёт другой поединок') {
    super('ACTIVE_BOUT_CONFLICT', message)
    this.name = 'ActiveBoutConflictError'
  }
}

export class BoutNotOnMatError extends MatControlError {
  constructor(message = 'Поединок не назначен на эту площадку') {
    super('BOUT_NOT_ON_MAT', message)
    this.name = 'BoutNotOnMatError'
  }
}

export class PeriodNotExpiredError extends MatControlError {
  constructor(message = 'Период ещё не истёк') {
    super('PERIOD_NOT_EXPIRED', message)
    this.name = 'PeriodNotExpiredError'
  }
}

export class ParticipantCornerMismatchError extends MatControlError {
  constructor(message = 'Спортсмен не соответствует указанному углу') {
    super('PARTICIPANT_CORNER_MISMATCH', message)
    this.name = 'ParticipantCornerMismatchError'
  }
}

export class ForeignEntryIdError extends MatControlError {
  constructor(message = 'Спортсмен не участвует в этом поединке') {
    super('FOREIGN_ENTRY_ID', message)
    this.name = 'ForeignEntryIdError'
  }
}

export class BoutNotFoundError extends MatControlError {
  constructor(message = 'Поединок не найден в расписании') {
    super('BOUT_NOT_FOUND', message, 404)
    this.name = 'BoutNotFoundError'
  }
}

export class CorrectionBlockedError extends MatControlError {
  readonly blockingBoutIds: string[]

  constructor(blockingBoutIds: string[], message = 'Коррекция заблокирована: downstream бой в live') {
    super('CORRECTION_BLOCKED', message)
    this.name = 'CorrectionBlockedError'
    this.blockingBoutIds = blockingBoutIds
  }
}

export class CommandReservationRaceError extends Error {
  constructor() {
    super('Command reservation race')
    this.name = 'CommandReservationRaceError'
  }
}

export class DisqualificationConfirmationRequiredError extends MatControlError {
  constructor(
    message = 'Для дисквалификации требуется явное подтверждение оператора',
  ) {
    super('DISQUALIFICATION_CONFIRMATION_REQUIRED', message)
    this.name = 'DisqualificationConfirmationRequiredError'
  }
}

export class EventFinalizedError extends MatControlError {
  constructor(message = 'Мероприятие завершено: mat control доступен только для просмотра') {
    super('EVENT_FINALIZED', message, 423)
    this.name = 'EventFinalizedError'
  }
}

export class SessionSupersededError extends MatControlError {
  constructor(message = 'Сессия боя устарела — ownership superseded') {
    super('SESSION_SUPERSEDED', message)
    this.name = 'SessionSupersededError'
  }
}

export class BoutAlreadyCommittedError extends MatControlError {
  constructor(message = 'Результат боя уже зафиксирован') {
    super('BOUT_ALREADY_COMMITTED', message)
    this.name = 'BoutAlreadyCommittedError'
  }
}

export class BoutSessionAlreadyActiveError extends MatControlError {
  constructor(message = 'Активная сессия боя уже существует') {
    super('BOUT_SESSION_ALREADY_ACTIVE', message)
    this.name = 'BoutSessionAlreadyActiveError'
  }
}

export class AlreadyCommittedDifferentPayloadError extends MatControlError {
  constructor(message = 'Бой уже committed с другим packageHash') {
    super('ALREADY_COMMITTED_DIFFERENT_PAYLOAD', message)
    this.name = 'AlreadyCommittedDifferentPayloadError'
  }
}

export class ExpectedSequenceError extends MatControlError {
  readonly expectedSequenceNo?: number
  constructor(message = 'Неверный sequenceNo команды', expectedSequenceNo?: number) {
    super('EXPECTED_SEQUENCE', message)
    this.name = 'ExpectedSequenceError'
    this.expectedSequenceNo = expectedSequenceNo
  }
}
