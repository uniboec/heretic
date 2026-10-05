import { CommandNotAllowedError } from './mat-control/errors'
import { computeClockElapsedMs } from './stopClockAt'
import type { BoutEventRecord, MatControlExecution } from './mat-control/types'

const UNDOABLE_TYPES = new Set<BoutEventRecord['eventType']>([
  'TECHNICAL_SCORE',
  'PENALTY',
  'ADJUDICATION',
  'CORNER_SWAP',
  'FIRST_CALL',
  'SECONDARY_CALL',
  'ATHLETE_WAIT_START',
  'ATHLETE_WAIT_END',
  'ATHLETE_DOCTOR_START',
  'ATHLETE_DOCTOR_END',
  'ATHLETE_EQUIPMENT_START',
  'ATHLETE_EQUIPMENT_END',
  'CLOCK_ADJUST',
])

function activeEvents(events: BoutEventRecord[], attemptNumber: number): BoutEventRecord[] {
  return events.filter((event) => !event.undoneAt && event.attemptNumber === attemptNumber)
}

function collectEpisodeScope(
  events: BoutEventRecord[],
  episodeId: string,
): BoutEventRecord[] {
  const scoring = events.filter(
    (event) => event.eventType === 'TECHNICAL_SCORE' && event.episodeId === episodeId,
  )
  const adjudication = events.filter((event) => {
    if (event.eventType !== 'ADJUDICATION') return false
    const payload = event.payload as { episodeId?: string } | null
    return payload?.episodeId === episodeId
  })
  return [...scoring, ...adjudication]
}

function collectLateAppearanceBundle(
  events: BoutEventRecord[],
  anchor: BoutEventRecord,
): BoutEventRecord[] | null {
  const sorted = [...events].sort((a, b) => a.sequence - b.sequence)
  const anchorIndex = sorted.findIndex((event) => event.id === anchor.id)
  if (anchorIndex < 0) return null

  if (anchor.eventType === 'ATHLETE_WAIT_END') {
    const batch = [anchor]
    for (let index = anchorIndex + 1; index < sorted.length; index++) {
      const event = sorted[index]!
      if (event.eventType === 'PENALTY' && event.entryId === anchor.entryId) {
        batch.push(event)
        continue
      }
      break
    }
    return batch
  }

  if (anchor.eventType !== 'PENALTY') return null

  let waitEndIndex = -1
  for (let index = anchorIndex - 1; index >= 0; index--) {
    const event = sorted[index]!
    if (event.eventType === 'ATHLETE_WAIT_END' && event.entryId === anchor.entryId) {
      waitEndIndex = index
      break
    }
    if (event.eventType !== 'PENALTY' || event.entryId !== anchor.entryId) {
      return null
    }
  }
  if (waitEndIndex < 0) return null

  const batch: BoutEventRecord[] = []
  for (let index = waitEndIndex; index < sorted.length; index++) {
    const event = sorted[index]!
    if (index === waitEndIndex) {
      batch.push(event)
      continue
    }
    if (event.eventType === 'PENALTY' && event.entryId === anchor.entryId) {
      batch.push(event)
      continue
    }
    break
  }
  return batch
}

function collectAdjudicationBatch(events: BoutEventRecord[], anchor: BoutEventRecord): BoutEventRecord[] {
  if (anchor.eventType === 'ADJUDICATION') {
    const payload = anchor.payload as { episodeId?: string } | null
    const episodeId = payload?.episodeId ?? anchor.episodeId
    if (!episodeId) return [anchor]

    const technical = events.find(
      (event) =>
        event.eventType === 'TECHNICAL_SCORE' &&
        event.episodeId === episodeId &&
        (event.payload as { source?: string } | null)?.source === 'ADJUDICATION',
    )
    return technical ? [technical, anchor] : [anchor]
  }

  if (anchor.eventType !== 'TECHNICAL_SCORE') return [anchor]
  const source = anchor.payload as { source?: string } | null
  if (source?.source !== 'ADJUDICATION') return [anchor]

  const adjudication = events.find((event) => {
    if (event.eventType !== 'ADJUDICATION') return false
    const payload = event.payload as { episodeId?: string } | null
    return payload?.episodeId === anchor.episodeId
  })

  return adjudication ? [anchor, adjudication] : [anchor]
}

function resolveUndoTargets(input: {
  events: BoutEventRecord[]
  attemptNumber: number
  payload: { targetEpisodeId?: string; targetEventIds?: string[] }
}): BoutEventRecord[] {
  const active = activeEvents(input.events, input.attemptNumber)

  if (input.payload.targetEpisodeId) {
    return collectEpisodeScope(active, input.payload.targetEpisodeId)
  }

  if (input.payload.targetEventIds?.length) {
    const ids = new Set(input.payload.targetEventIds)
    const selected = active.filter((event) => ids.has(event.id))
    const expanded: BoutEventRecord[] = []
    for (const event of selected) {
      expanded.push(...collectAdjudicationBatch(active, event))
    }
    return [...new Map(expanded.map((event) => [event.id, event])).values()]
  }

  const undoable = active.filter((event) => UNDOABLE_TYPES.has(event.eventType))
  const latest = undoable[undoable.length - 1]
  if (!latest) return []

  if (latest.episodeId && latest.eventType === 'TECHNICAL_SCORE') {
    const episodeScope = collectEpisodeScope(active, latest.episodeId)
    if (episodeScope.length > 1) return episodeScope
  }

  const lateAppearanceBundle = collectLateAppearanceBundle(active, latest)
  if (lateAppearanceBundle && lateAppearanceBundle.length > 1) {
    return lateAppearanceBundle
  }

  return collectAdjudicationBatch(active, latest)
}

export function previewUndoTargets(input: {
  events: BoutEventRecord[]
  attemptNumber: number
  payload: { targetEpisodeId?: string; targetEventIds?: string[] }
}): BoutEventRecord[] {
  return resolveUndoTargets(input)
}

export function assertExtraPeriodUndoTargets(targets: BoutEventRecord[]): void {
  if (targets.some((event) => event.period !== 'extra')) {
    throw new CommandNotAllowedError(
      'В режиме коррекции активности можно отменять только события extra-периода',
    )
  }
}

export function applyCompoundUndo(input: {
  execution: MatControlExecution
  events: BoutEventRecord[]
  payload: { targetEpisodeId?: string; targetEventIds?: string[] }
  now: Date
  operationId: string
}): {
  execution: MatControlExecution
  undoneEvents: BoutEventRecord[]
  undoEvent: BoutEventRecord
} {
  const targets = resolveUndoTargets({
    events: input.events,
    attemptNumber: input.execution.attemptNumber,
    payload: input.payload,
  })

  if (targets.length === 0) {
    throw new Error('Нет событий для отмены')
  }

  const undoneIds = new Set(targets.map((event) => event.id))
  const undoneEvents = input.events.map((event) =>
    undoneIds.has(event.id) ? { ...event, undoneAt: input.now } : event,
  )

  const undoEvent: BoutEventRecord = {
    id: `undo-${input.execution.nextEventSequence}`,
    boutId: input.execution.boutId,
    clientEventId: input.operationId,
    sequence: input.execution.nextEventSequence,
    eventType: 'UNDO',
    entryId: null,
    cornerAtEvent: null,
    points: null,
    episodeId: input.payload.targetEpisodeId ?? null,
    boutElapsedMs: computeClockElapsedMs(input.execution, input.now),
    period: input.execution.currentPeriod,
    attemptNumber: input.execution.attemptNumber,
    payload: {
      targetEpisodeId: input.payload.targetEpisodeId,
      targetEventIds: targets.map((event) => event.id),
    },
    undoneAt: null,
    createdAt: input.now,
  }

  const execution: MatControlExecution = {
    ...input.execution,
    nextEventSequence: input.execution.nextEventSequence + 1,
  }

  return { execution, undoneEvents, undoEvent }
}
