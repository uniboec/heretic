import type { VictoryMethod } from '../config/fseRules'
import { closeOpenAuxiliaryEvents } from './closeOpenAuxiliaryEvents'
import { resolveOfficialEndedAt } from './resolveOfficialEndedAt'
import { computeClockElapsedMs, stopClockAt } from './stopClockAt'
import type {
  BoutDecision,
  BoutEventRecord,
  BoutParticipantContext,
  MatControlExecution,
  StoppageTrigger,
} from './mat-control/types'

export type RecordBoutStoppageInput = {
  execution: MatControlExecution
  events: BoutEventRecord[]
  participants: BoutParticipantContext
  decision: BoutDecision
  trigger: StoppageTrigger
  victoryMethod: VictoryMethod
  now: Date
  triggerEventId?: string
  boutElapsedMs?: number
  operationId?: string
}

export function recordBoutStoppage(input: RecordBoutStoppageInput): {
  execution: MatControlExecution
  stoppageEvent: BoutEventRecord
  auxiliaryCloseEvents: BoutEventRecord[]
} {
  const endedAt = resolveOfficialEndedAt(input.execution, input.trigger)
  let execution = input.execution

  if (execution.clockState === 'running') {
    execution = stopClockAt(execution, input.now)
  } else {
    execution = { ...execution, clockState: 'stopped' }
  }

  const auxiliaryClosed = closeOpenAuxiliaryEvents({
    execution,
    events: input.events,
    operationId: input.operationId ?? 'stoppage-aux-close',
    now: input.now,
  })
  execution = auxiliaryClosed.execution
  const auxiliaryCloseEvents = auxiliaryClosed.createdEvents

  const boutElapsedMs =
    input.boutElapsedMs ?? computeClockElapsedMs(execution, input.now)

  const stoppageEvent: BoutEventRecord = {
    id: `stoppage-${execution.nextEventSequence}`,
    boutId: execution.boutId,
    clientEventId: `stoppage-${execution.nextEventSequence}`,
    sequence: execution.nextEventSequence,
    eventType: 'BOUT_STOPPAGE',
    entryId: null,
    cornerAtEvent: null,
    points: null,
    episodeId: null,
    boutElapsedMs,
    period: execution.currentPeriod,
    attemptNumber: execution.attemptNumber,
    payload: {
      winnerEntryId: input.decision.winnerEntryId,
      loserEntryId: input.decision.loserEntryId,
      proposedVictoryMethod: input.victoryMethod,
      proposedDecisionReason: input.decision.reason,
      submissionSubtype: input.decision.details?.submissionSubtype,
      officialEndedAt: endedAt.toISOString(),
      boutElapsedMs,
      period: execution.currentPeriod,
      trigger: input.trigger,
      triggerEventId: input.triggerEventId,
    },
    undoneAt: null,
    createdAt: input.now,
  }

  execution = {
    ...execution,
    boutPhase: 'pending_confirmation',
    officialEndedAt: execution.officialEndedAt ?? endedAt,
    nextEventSequence: execution.nextEventSequence + 1,
  }

  return { execution, stoppageEvent, auxiliaryCloseEvents }
}

export function beginPendingActivityDecision(
  execution: MatControlExecution,
): MatControlExecution {
  return {
    ...execution,
    boutPhase: 'pending_activity_decision',
    clockState: 'stopped',
    officialEndedAt: execution.officialEndedAt ?? execution.extraEndedAt,
  }
}
