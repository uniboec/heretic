import { mapDecisionReasonForPeriodCount } from './boutLiveSnapshot'
import { beginPendingActivityDecision, recordBoutStoppage } from './recordBoutStoppage'
import { startExtraRound } from './startExtraRound'
import type {
  BoutEventRecord,
  BoutParticipantContext,
  MatControlExecution,
} from './mat-control/types'
import { reResolveAfterPeriodEnd } from './reResolveAfterPeriodEnd'

export { getEventsForCurrentAttempt, resolveCorrectedPeriod } from './reResolveAfterPeriodEnd'

export function finishPeriodCorrection(input: {
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
    periodCorrectionMode: false,
  }

  const resolved = reResolveAfterPeriodEnd({
    execution,
    events: input.events,
    participants: input.participants,
  })
  const decision = {
    ...resolved,
    reason: mapDecisionReasonForPeriodCount({
      reason: resolved.reason,
      period: execution.currentPeriod,
      liveSnapshot: execution.liveSnapshot,
    }),
  }

  if (execution.currentPeriod === 'main') {
    if (decision.reason === 'EXTRA_ROUND_REQUIRED') {
      execution = startExtraRound(execution)
      return { execution }
    }

    if (decision.reason === 'EXTRA_ACTIVITY') {
      execution = beginPendingActivityDecision(execution)
      return { execution }
    }

    const stoppage = recordBoutStoppage({
      execution,
      events: input.events,
      participants: input.participants,
      decision,
      trigger: 'TIME_EXPIRED',
      victoryMethod: 'POINTS',
      now: input.now,
    })
    return {
      execution: stoppage.execution,
      stoppageEvent: stoppage.stoppageEvent,
      auxiliaryCloseEvents: stoppage.auxiliaryCloseEvents,
    }
  }

  if (decision.reason === 'EXTRA_ACTIVITY') {
    execution = beginPendingActivityDecision(execution)
    return { execution }
  }

  const stoppage = recordBoutStoppage({
    execution,
    events: input.events,
    participants: input.participants,
    decision,
    trigger: 'TIME_EXPIRED',
    victoryMethod: 'POINTS',
    now: input.now,
  })
  return {
    execution: stoppage.execution,
    stoppageEvent: stoppage.stoppageEvent,
    auxiliaryCloseEvents: stoppage.auxiliaryCloseEvents,
  }
}
