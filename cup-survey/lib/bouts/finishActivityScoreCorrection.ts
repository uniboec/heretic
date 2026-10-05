import { beginPendingActivityDecision, recordBoutStoppage } from './recordBoutStoppage'
import { getEventsForCurrentAttempt } from './reResolveAfterPeriodEnd'
import { resolveBoutDecision } from './scoreEngine'
import type {
  BoutEventRecord,
  BoutParticipantContext,
  MatControlExecution,
} from './mat-control/types'

export function finishActivityScoreCorrection(input: {
  execution: MatControlExecution
  events: BoutEventRecord[]
  participants: BoutParticipantContext
  now: Date
}): {
  execution: MatControlExecution
  stoppageEvent?: ReturnType<typeof recordBoutStoppage>['stoppageEvent']
  auxiliaryCloseEvents?: ReturnType<typeof recordBoutStoppage>['auxiliaryCloseEvents']
} {
  let execution: MatControlExecution = {
    ...input.execution,
    activityCorrectionMode: false,
  }

  const attemptEvents = getEventsForCurrentAttempt(input.events, execution.attemptNumber)
  const decision = resolveBoutDecision({
    events: attemptEvents,
    period: 'extra',
    attemptNumber: execution.attemptNumber,
    participants: input.participants,
  })

  if (!decision.winnerEntryId) {
    execution = beginPendingActivityDecision(execution)
    return { execution }
  }

  const stoppage = recordBoutStoppage({
    execution,
    events: input.events,
    participants: input.participants,
    decision,
    trigger: 'ACTIVITY_CORRECTION',
    victoryMethod: 'POINTS',
    now: input.now,
  })

  return {
    execution: stoppage.execution,
    stoppageEvent: stoppage.stoppageEvent,
    auxiliaryCloseEvents: stoppage.auxiliaryCloseEvents,
  }
}
