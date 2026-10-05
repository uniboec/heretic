import type { ControlIntent } from './mat-control/types'

const SCHEDULE_FREEZE_INTENTS = new Set<ControlIntent>([
  'CLOCK_START',
  'NO_SHOW',
  'STOPPAGE_CLEAR_ADVANTAGE',
  'STOPPAGE_FORFEIT',
  'STOPPAGE_INJURY',
  'STOPPAGE_SUBMISSION',
  'STOPPAGE_CHOKE',
  'PENALTY_DISQUALIFY',
  'ATHLETE_EQUIPMENT_DISQUALIFY',
  'CONFIRM',
])

export function isScheduleFreezeIntent(intent: ControlIntent): boolean {
  return SCHEDULE_FREEZE_INTENTS.has(intent)
}

export function shouldFreezeBeforeMatControl(input: {
  intent: ControlIntent
  actualStartAt: Date | null | undefined
  frozenScheduleFormatted: string | null | undefined
}): boolean {
  if (!isScheduleFreezeIntent(input.intent)) {
    return false
  }
  if (input.frozenScheduleFormatted) {
    return false
  }
  if (input.intent === 'CONFIRM' && input.actualStartAt) {
    return false
  }
  return true
}
