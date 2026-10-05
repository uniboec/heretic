import { resolveBoutDecision } from './scoreEngine'
import type {
  BoutDecision,
  BoutEventRecord,
  BoutParticipantContext,
  MatControlExecution,
} from './mat-control/types'

export function resolveCorrectedPeriod(execution: MatControlExecution): 'main' | 'extra' {
  if (execution.currentPeriod === 'extra') {
    return 'extra'
  }
  if (execution.extraEndedAt) {
    return 'extra'
  }
  return 'main'
}

export function getEventsForCurrentAttempt(
  events: BoutEventRecord[],
  attemptNumber: number,
): BoutEventRecord[] {
  return events.filter((event) => event.attemptNumber === attemptNumber)
}

export function reResolveAfterPeriodEnd(input: {
  execution: MatControlExecution
  events: BoutEventRecord[]
  participants: BoutParticipantContext
}): BoutDecision {
  const correctedPeriod = resolveCorrectedPeriod(input.execution)
  const attemptEvents = getEventsForCurrentAttempt(input.events, input.execution.attemptNumber)

  return resolveBoutDecision({
    events: attemptEvents,
    period: correctedPeriod,
    attemptNumber: input.execution.attemptNumber,
    participants: input.participants,
  })
}
