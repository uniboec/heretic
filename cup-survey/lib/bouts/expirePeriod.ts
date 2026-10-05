import { CommandNotAllowedError, PeriodNotExpiredError } from './mat-control/errors'
import { onExtraTimeExpired } from './onExtraTimeExpired'
import { onMainTimeExpired } from './onMainTimeExpired'
import { computeClockElapsedMs, computePeriodDeadlineAt } from './stopClockAt'
import type {
  BoutEventRecord,
  BoutParticipantContext,
  BoutPeriod,
  MatControlExecution,
} from './mat-control/types'

export function recordPeriodEnded(input: {
  execution: MatControlExecution
  period: BoutPeriod
  now: Date
}): { execution: MatControlExecution; periodEvent: BoutEventRecord } {
  const periodEvent: BoutEventRecord = {
    id: `period-${input.execution.nextEventSequence}`,
    boutId: input.execution.boutId,
    clientEventId: `period-${input.execution.nextEventSequence}`,
    sequence: input.execution.nextEventSequence,
    eventType: 'PERIOD_ENDED',
    entryId: null,
    cornerAtEvent: null,
    points: null,
    episodeId: null,
    boutElapsedMs: computeClockElapsedMs(input.execution, input.now),
    period: input.period,
    attemptNumber: input.execution.attemptNumber,
    payload: {
      period: input.period,
      endedAt: input.now.toISOString(),
    },
    undoneAt: null,
    createdAt: input.now,
  }

  const execution: MatControlExecution = {
    ...input.execution,
    clockState: 'stopped',
    clockStartedAt: null,
    nextEventSequence: input.execution.nextEventSequence + 1,
    ...(input.period === 'main'
      ? { mainEndedAt: input.execution.mainEndedAt ?? input.now }
      : { extraEndedAt: input.execution.extraEndedAt ?? input.now }),
  }

  return { execution, periodEvent }
}

export function expirePeriod(input: {
  execution: MatControlExecution
  events: BoutEventRecord[]
  participants: BoutParticipantContext
  period: BoutPeriod
  periodDurationMs: number
  now: Date
}): {
  execution: MatControlExecution
  createdEvents: BoutEventRecord[]
  alreadyProcessed: boolean
} {
  const alreadyProcessed =
    (input.period === 'main' && input.execution.mainEndedAt != null) ||
    (input.period === 'extra' && input.execution.extraEndedAt != null)

  if (alreadyProcessed) {
    return { execution: input.execution, createdEvents: [], alreadyProcessed: true }
  }

  if (input.period !== input.execution.currentPeriod) {
    throw new CommandNotAllowedError('Нельзя завершить период, который сейчас не идёт')
  }

  const elapsedMs = computeClockElapsedMs(input.execution, input.now)
  if (elapsedMs < input.periodDurationMs) {
    throw new PeriodNotExpiredError()
  }

  const deadline = computePeriodDeadlineAt(input.execution, input.periodDurationMs)
  if (deadline && input.now.getTime() < deadline.getTime()) {
    throw new PeriodNotExpiredError()
  }

  const { execution: afterPeriod, periodEvent } = recordPeriodEnded({
    execution: input.execution,
    period: input.period,
    now: input.now,
  })

  if (input.period === 'main') {
    const result = onMainTimeExpired({
      execution: afterPeriod,
      events: [...input.events, periodEvent],
      participants: input.participants,
      now: input.now,
    })
    return {
      execution: result.execution,
      createdEvents: [periodEvent, ...result.createdEvents],
      alreadyProcessed: false,
    }
  }

  const result = onExtraTimeExpired({
    execution: afterPeriod,
    events: [...input.events, periodEvent],
    participants: input.participants,
    now: input.now,
  })
  return {
    execution: result.execution,
    createdEvents: [periodEvent, ...result.createdEvents],
    alreadyProcessed: false,
  }
}
