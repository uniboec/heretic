import { beginPendingActivityDecision, recordBoutStoppage } from './recordBoutStoppage'
import { resolveBoutDecision } from './scoreEngine'
import type {
  BoutEventRecord,
  BoutParticipantContext,
  MatControlExecution,
} from './mat-control/types'

export function onExtraTimeExpired(input: {
  execution: MatControlExecution
  events: BoutEventRecord[]
  participants: BoutParticipantContext
  now: Date
}): {
  execution: MatControlExecution
  createdEvents: BoutEventRecord[]
} {
  const decision = resolveBoutDecision({
    events: input.events,
    period: 'extra',
    attemptNumber: input.execution.attemptNumber,
    participants: input.participants,
  })

  if (decision.reason === 'EXTRA_ACTIVITY') {
    return {
      execution: beginPendingActivityDecision(input.execution),
      createdEvents: [],
    }
  }

  const stoppage = recordBoutStoppage({
    execution: input.execution,
    events: input.events,
    participants: input.participants,
    decision,
    trigger: 'TIME_EXPIRED',
    victoryMethod: 'POINTS',
    now: input.now,
  })

  return {
    execution: stoppage.execution,
    createdEvents: [...stoppage.auxiliaryCloseEvents, stoppage.stoppageEvent],
  }
}
