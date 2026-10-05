import { mapDecisionReasonForPeriodCount } from './boutLiveSnapshot'
import { beginPendingActivityDecision, recordBoutStoppage } from './recordBoutStoppage'
import { resolveBoutDecision } from './scoreEngine'
import { startExtraRound } from './startExtraRound'
import type {
  BoutEventRecord,
  BoutParticipantContext,
  MatControlExecution,
} from './mat-control/types'

export function onMainTimeExpired(input: {
  execution: MatControlExecution
  events: BoutEventRecord[]
  participants: BoutParticipantContext
  now: Date
}): {
  execution: MatControlExecution
  createdEvents: BoutEventRecord[]
} {
  const resolved = resolveBoutDecision({
    events: input.events,
    period: 'main',
    attemptNumber: input.execution.attemptNumber,
    participants: input.participants,
  })
  const decision = {
    ...resolved,
    reason: mapDecisionReasonForPeriodCount({
      reason: resolved.reason,
      period: 'main',
      liveSnapshot: input.execution.liveSnapshot,
    }),
  }

  if (decision.reason === 'EXTRA_ROUND_REQUIRED') {
    return {
      execution: startExtraRound(input.execution),
      createdEvents: [],
    }
  }

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
