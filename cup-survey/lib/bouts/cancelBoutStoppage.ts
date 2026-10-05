import { stopClockAt } from './stopClockAt'
import type {
  BoutEventRecord,
  CancelStoppageMode,
  MatControlExecution,
  MatControlSessionRecord,
} from './mat-control/types'

function resolveCancelStoppageMode(
  stoppageEvent: BoutEventRecord,
  execution: MatControlExecution,
): CancelStoppageMode {
  const trigger = (stoppageEvent.payload as { trigger?: string } | null)?.trigger

  if (trigger === 'NO_SHOW' && execution.officialStartedAt == null) {
    return 'NO_SHOW_REVERT'
  }

  if (trigger === 'TIME_EXPIRED') {
    return 'PERIOD_END_CORRECTION'
  }

  if (trigger === 'EXTRA_ACTIVITY' || trigger === 'ACTIVITY_CORRECTION') {
    return 'ACTIVITY_DECISION_REVERT'
  }

  return 'EARLY_STOPPAGE_REVERT'
}

export function cancelBoutStoppage(input: {
  execution: MatControlExecution
  session: MatControlSessionRecord
  stoppageEvent: BoutEventRecord
  now: Date
}): {
  execution: MatControlExecution
  session: MatControlSessionRecord
  mode: CancelStoppageMode
  cancelledEventIds: string[]
} {
  const mode = resolveCancelStoppageMode(input.stoppageEvent, input.execution)
  let execution = input.execution
  let session = input.session
  const cancelledEventIds = [input.stoppageEvent.id]

  switch (mode) {
    case 'NO_SHOW_REVERT':
      execution = {
        ...execution,
        boutPhase: 'scheduled',
        clockState: 'idle',
        clockStartedAt: null,
        clockElapsedBeforeStartMs: 0,
        officialStartedAt: null,
        officialEndedAt: null,
        mainEndedAt: null,
        extraEndedAt: null,
        periodCorrectionMode: false,
        activityCorrectionMode: false,
      }
      session = { ...session, activeBoutId: null }
      break

    case 'EARLY_STOPPAGE_REVERT':
      if (execution.officialStartedAt == null) {
        execution = {
          ...execution,
          boutPhase: 'scheduled',
          clockState: 'idle',
          clockStartedAt: null,
          clockElapsedBeforeStartMs: 0,
          officialEndedAt: null,
          activityCorrectionMode: false,
        }
      } else {
        execution = stopClockAt(execution, input.now)
        execution = {
          ...execution,
          boutPhase: 'live',
          officialEndedAt: null,
          activityCorrectionMode: false,
        }
      }
      break

    case 'PERIOD_END_CORRECTION':
      execution = {
        ...execution,
        boutPhase: 'live',
        clockState: 'stopped',
        periodCorrectionMode: true,
        officialEndedAt: null,
        activityCorrectionMode: false,
      }
      break

    case 'ACTIVITY_DECISION_REVERT':
      execution = {
        ...execution,
        boutPhase: 'pending_activity_decision',
        activityCorrectionMode: false,
      }
      break
  }

  return { execution, session, mode, cancelledEventIds }
}
