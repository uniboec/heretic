import { CommandNotAllowedError } from './mat-control/errors'
import type { ControlIntent, MatControlExecution } from './mat-control/types'

const SCORING_INTENTS = new Set<ControlIntent>([
  'TECHNICAL_SCORE',
  'ADJUDICATION_SCORE',
  'PENALTY_GENERAL_NEXT',
  'PENALTY_OUT_OF_BOUNDS_NEXT',
  'PENALTY_PASSIVITY_NEXT',
  'PENALTY_DISQUALIFY',
])

const STOPPAGE_INTENTS = new Set<ControlIntent>([
  'STOPPAGE_SUBMISSION',
  'STOPPAGE_CHOKE',
  'STOPPAGE_CLEAR_ADVANTAGE',
  'STOPPAGE_FORFEIT',
  'STOPPAGE_INJURY',
])

const SCHEDULED_WORKSPACE_INTENTS = new Set<ControlIntent>([
  ...SCORING_INTENTS,
  'CORNER_SWAP',
  'FIRST_CALL',
  'SECONDARY_CALL',
  'ATHLETE_WAIT_START',
  'ATHLETE_WAIT_END',
  'ATHLETE_DOCTOR_START',
  'ATHLETE_DOCTOR_END',
  'ATHLETE_DOCTOR_REMOVAL',
  'ATHLETE_EQUIPMENT_START',
  'ATHLETE_EQUIPMENT_END',
  'ATHLETE_EQUIPMENT_DISQUALIFY',
  'NO_SHOW',
  'CLOCK_START',
  'POSTPONE',
  'PASSIVITY_START',
  'PASSIVITY_END',
  'SET_BOUT_TIMING',
  'UNDO',
])

function isAllowedInPeriodCorrection(intent: ControlIntent): boolean {
  return (
    SCORING_INTENTS.has(intent) ||
    intent === 'UNDO' ||
    intent === 'FINISH_PERIOD_CORRECTION'
  )
}

function isAllowedInActivityCorrection(intent: ControlIntent): boolean {
  return (
    intent === 'TECHNICAL_SCORE' ||
    intent === 'PENALTY_GENERAL_NEXT' ||
    intent === 'PENALTY_OUT_OF_BOUNDS_NEXT' ||
    intent === 'PENALTY_PASSIVITY_NEXT' ||
    intent === 'PENALTY_DISQUALIFY' ||
    intent === 'UNDO' ||
    intent === 'FINISH_ACTIVITY_CORRECTION'
  )
}

function isAllowedInPhase(execution: MatControlExecution, intent: ControlIntent): boolean {
  const phase = execution.boutPhase

  switch (phase) {
    case 'scheduled':
      return SCHEDULED_WORKSPACE_INTENTS.has(intent) || STOPPAGE_INTENTS.has(intent)
    case 'live':
      return (
        SCORING_INTENTS.has(intent) ||
        intent === 'CLOCK_START' ||
        intent === 'CLOCK_STOP' ||
        intent === 'CLOCK_ADJUST' ||
        intent === 'EXPIRE_PERIOD' ||
        intent === 'UNDO' ||
        STOPPAGE_INTENTS.has(intent) ||
        intent === 'PASSIVITY_START' ||
        intent === 'PASSIVITY_END' ||
        intent === 'PASSIVITY_APPLY_DUE_PENALTIES' ||
        intent === 'ATHLETE_WAIT_START' ||
        intent === 'ATHLETE_WAIT_END' ||
        intent === 'ATHLETE_DOCTOR_START' ||
        intent === 'ATHLETE_DOCTOR_END' ||
        intent === 'ATHLETE_DOCTOR_REMOVAL' ||
        intent === 'ATHLETE_EQUIPMENT_START' ||
        intent === 'ATHLETE_EQUIPMENT_END' ||
        intent === 'ATHLETE_EQUIPMENT_DISQUALIFY' ||
        intent === 'SET_BOUT_TIMING'
      )
    case 'pending_activity_decision':
      return intent === 'EXTRA_ACTIVITY_DECIDE' || intent === 'CORRECT_BEFORE_ACTIVITY'
    case 'pending_confirmation':
      return intent === 'CANCEL_STOPPAGE' || intent === 'CONFIRM'
    case 'confirmed':
      return intent === 'OPEN_NEXT_BOUT'
    default:
      return false
  }
}

export function assertCommandAllowed(execution: MatControlExecution, intent: ControlIntent): void {
  if (intent === 'RESET_BOUT' || intent === 'CORNER_SWAP') {
    return
  }

  if (execution.periodCorrectionMode) {
    if (!isAllowedInPeriodCorrection(intent)) {
      throw new CommandNotAllowedError('Команда недоступна в режиме коррекции периода')
    }
    return
  }

  if (execution.activityCorrectionMode) {
    if (intent === 'EXTRA_ACTIVITY_DECIDE') {
      throw new CommandNotAllowedError('Сначала завершите исправление счёта extra')
    }
    if (!isAllowedInActivityCorrection(intent) && intent !== 'CORRECT_BEFORE_ACTIVITY') {
      throw new CommandNotAllowedError('Команда недоступна в режиме коррекции активности')
    }
    return
  }

  if (!isAllowedInPhase(execution, intent)) {
    throw new CommandNotAllowedError()
  }
}

