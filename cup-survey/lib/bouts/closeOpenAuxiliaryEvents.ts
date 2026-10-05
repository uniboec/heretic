import { listOpenAuxiliaryCloseSpecs } from './auxiliaryTimers'
import { computeClockElapsedMs } from './stopClockAt'
import type { BoutEventRecord, MatControlExecution } from './mat-control/types'

export function closeOpenAuxiliaryEvents(input: {
  execution: MatControlExecution
  events: BoutEventRecord[]
  operationId: string
  now: Date
}): { execution: MatControlExecution; createdEvents: BoutEventRecord[] } {
  const createdEvents: BoutEventRecord[] = []
  let execution = input.execution

  for (const [index, spec] of listOpenAuxiliaryCloseSpecs(
    input.events,
    execution.attemptNumber,
  ).entries()) {
    const event: BoutEventRecord = {
      id: `evt-${execution.nextEventSequence}`,
      boutId: execution.boutId,
      sequence: execution.nextEventSequence,
      attemptNumber: execution.attemptNumber,
      undoneAt: null,
      createdAt: input.now,
      clientEventId: `${input.operationId}-aux-close-${index}`,
      eventType: spec.intent,
      entryId: spec.entryId,
      cornerAtEvent: spec.corner,
      points: null,
      episodeId: null,
      boutElapsedMs: computeClockElapsedMs(execution, input.now),
      period: execution.currentPeriod,
      payload: { autoClose: true },
    }
    execution = { ...execution, nextEventSequence: execution.nextEventSequence + 1 }
    createdEvents.push(event)
  }

  return { execution, createdEvents }
}
