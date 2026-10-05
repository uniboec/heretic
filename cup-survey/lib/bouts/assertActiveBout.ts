import { ActiveBoutConflictError, NotActiveBoutError } from './mat-control/errors'
import type { ControlIntent, MatControlExecution, MatControlSessionRecord } from './mat-control/types'

const PRE_FIGHT_INTENTS = new Set<ControlIntent>([
  'FIRST_CALL',
  'SECONDARY_CALL',
  'POSTPONE',
])

const STOPPAGE_INTENTS = new Set<ControlIntent>([
  'STOPPAGE_SUBMISSION',
  'STOPPAGE_CHOKE',
  'STOPPAGE_CLEAR_ADVANTAGE',
  'STOPPAGE_FORFEIT',
  'STOPPAGE_INJURY',
])

const ATHLETE_WAIT_INTENTS = new Set<ControlIntent>(['ATHLETE_WAIT_START', 'ATHLETE_WAIT_END'])

const ATHLETE_DOCTOR_INTENTS = new Set<ControlIntent>([
  'ATHLETE_DOCTOR_START',
  'ATHLETE_DOCTOR_END',
  'ATHLETE_DOCTOR_REMOVAL',
])

const ATHLETE_EQUIPMENT_INTENTS = new Set<ControlIntent>([
  'ATHLETE_EQUIPMENT_START',
  'ATHLETE_EQUIPMENT_END',
  'ATHLETE_EQUIPMENT_DISQUALIFY',
])

const SCHEDULED_WORKSPACE_INTENTS = new Set<ControlIntent>([
  'TECHNICAL_SCORE',
  'ADJUDICATION_SCORE',
  'PENALTY_GENERAL_NEXT',
  'PENALTY_OUT_OF_BOUNDS_NEXT',
  'PENALTY_PASSIVITY_NEXT',
  'PENALTY_DISQUALIFY',
  'PASSIVITY_START',
  'PASSIVITY_END',
  'PASSIVITY_APPLY_DUE_PENALTIES',
  'UNDO',
])

const BOUT_MUTATING_INTENTS = new Set<ControlIntent>([
  'TECHNICAL_SCORE',
  'ADJUDICATION_SCORE',
  'PENALTY_GENERAL_NEXT',
  'PENALTY_OUT_OF_BOUNDS_NEXT',
  'PENALTY_PASSIVITY_NEXT',
  'PENALTY_DISQUALIFY',
  'PASSIVITY_APPLY_DUE_PENALTIES',
  'CLOCK_STOP',
  'CLOCK_ADJUST',
  'EXPIRE_PERIOD',
  'UNDO',
  'FINISH_PERIOD_CORRECTION',
  'FINISH_ACTIVITY_CORRECTION',
  'STOPPAGE_SUBMISSION',
  'STOPPAGE_CHOKE',
  'STOPPAGE_CLEAR_ADVANTAGE',
  'STOPPAGE_FORFEIT',
  'STOPPAGE_INJURY',
  'EXTRA_ACTIVITY_DECIDE',
  'CONFIRM',
  'PASSIVITY_START',
  'PASSIVITY_END',
])

export function isPreFightIntent(intent: ControlIntent): boolean {
  return PRE_FIGHT_INTENTS.has(intent)
}

export function isBoutMutatingIntent(intent: ControlIntent): boolean {
  return BOUT_MUTATING_INTENTS.has(intent)
}

const SESSION_PIN_INTENTS = new Set<ControlIntent>([
  ...PRE_FIGHT_INTENTS,
  ...SCHEDULED_WORKSPACE_INTENTS,
  ...ATHLETE_WAIT_INTENTS,
  ...ATHLETE_DOCTOR_INTENTS,
  ...ATHLETE_EQUIPMENT_INTENTS,
  ...STOPPAGE_INTENTS,
  'NO_SHOW',
  'CORNER_SWAP',
])

export function shouldPinSessionActiveBout(input: {
  intent: ControlIntent
  executionPhase: MatControlExecution['boutPhase']
  sessionActiveBoutId: string | null
}): boolean {
  return (
    input.sessionActiveBoutId == null &&
    input.executionPhase === 'scheduled' &&
    SESSION_PIN_INTENTS.has(input.intent)
  )
}

export function pinSessionActiveBoutIfNeeded(input: {
  session: MatControlSessionRecord
  boutId: string
  execution: MatControlExecution
  intent: ControlIntent
}): MatControlSessionRecord {
  if (
    !shouldPinSessionActiveBout({
      intent: input.intent,
      executionPhase: input.execution.boutPhase,
      sessionActiveBoutId: input.session.activeBoutId,
    })
  ) {
    return input.session
  }

  return { ...input.session, activeBoutId: input.boutId }
}

function assertScheduledWorkspaceIntent(input: {
  session: MatControlSessionRecord
  boutId: string
  boutInMatQueue: boolean
}): void {
  if (!input.boutInMatQueue) {
    throw new NotActiveBoutError('Команда доступна только для поединка в очереди ковра')
  }
  if (input.session.activeBoutId && input.session.activeBoutId !== input.boutId) {
    throw new ActiveBoutConflictError()
  }
}

export function assertActiveBout(input: {
  session: MatControlSessionRecord
  boutId: string
  intent: ControlIntent
  execution: MatControlExecution
  boutInMatQueue: boolean
}): void {
  const { session, boutId, intent, execution, boutInMatQueue } = input

  if (
    ATHLETE_WAIT_INTENTS.has(intent) ||
    ATHLETE_DOCTOR_INTENTS.has(intent) ||
    ATHLETE_EQUIPMENT_INTENTS.has(intent)
  ) {
    if (execution.boutPhase === 'scheduled') {
      assertScheduledWorkspaceIntent({ session, boutId, boutInMatQueue })
      return
    }
    if (session.activeBoutId !== boutId) {
      throw new NotActiveBoutError()
    }
    return
  }

  if (execution.boutPhase === 'scheduled' && SCHEDULED_WORKSPACE_INTENTS.has(intent)) {
    assertScheduledWorkspaceIntent({ session, boutId, boutInMatQueue })
    return
  }

  if (isPreFightIntent(intent)) {
    if (!boutInMatQueue || execution.boutPhase !== 'scheduled') {
      throw new NotActiveBoutError('Pre-fight команда доступна только для scheduled поединка в очереди')
    }
    if (session.activeBoutId && session.activeBoutId !== boutId) {
      throw new ActiveBoutConflictError()
    }
    return
  }

  if (intent === 'CORNER_SWAP') {
    if (!boutInMatQueue) {
      throw new NotActiveBoutError('Смена углов доступна только для поединка на этом ковре')
    }
    if (session.activeBoutId && session.activeBoutId !== boutId) {
      throw new ActiveBoutConflictError()
    }
    return
  }

  if (intent === 'NO_SHOW' || (STOPPAGE_INTENTS.has(intent) && execution.boutPhase === 'scheduled')) {
    if (!boutInMatQueue || execution.boutPhase !== 'scheduled') {
      throw new NotActiveBoutError()
    }
    if (session.activeBoutId && session.activeBoutId !== boutId) {
      throw new ActiveBoutConflictError()
    }
    return
  }

  if (intent === 'OPEN_NEXT_BOUT') {
    if (execution.boutPhase !== 'confirmed') {
      throw new NotActiveBoutError('Переход доступен только после подтверждения результата')
    }
    if (session.activeBoutId !== boutId) {
      throw new NotActiveBoutError()
    }
    return
  }

  if (intent === 'CLOCK_START') {
    if (session.activeBoutId && session.activeBoutId !== boutId) {
      throw new ActiveBoutConflictError()
    }
    return
  }

  if (intent === 'RESET_BOUT') {
    if (!boutInMatQueue) {
      throw new NotActiveBoutError('Сброс доступен только для поединка на этом ковре')
    }
    return
  }

  if (isBoutMutatingIntent(intent)) {
    if (session.activeBoutId !== boutId) {
      throw new NotActiveBoutError()
    }
  }
}

