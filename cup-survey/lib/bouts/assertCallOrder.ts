import {
  assertNoShowAllowedForAthleteWait,
  hasActiveAthleteWaitForEntry,
} from './athleteWait'
import {
  BothFirstCallsRequiredError,
  FirstCallAlreadyRecordedError,
  FirstCallOrderViolationError,
  NoShowNotAllowedError,
  SecondaryCallAlreadyRecordedError,
  SecondaryCallTimerActiveError,
  SecondaryCallWithoutFirstError,
} from './mat-control/errors'
import type { BoutEventRecord, Corner } from './mat-control/types'
import { entryIdForCorner } from './assertBoutParticipantCorner'
import type { BoutParticipantContext } from './mat-control/types'

const SECONDARY_CALL_DURATION_MS = 120_000

export function hasAnyCallEvents(events: BoutEventRecord[]): boolean {
  return events.some(
    (event) =>
      !event.undoneAt &&
      (event.eventType === 'FIRST_CALL' || event.eventType === 'SECONDARY_CALL'),
  )
}

export function hasCallEventsForAttempt(
  events: BoutEventRecord[],
  attemptNumber: number,
): boolean {
  return events.some(
    (event) =>
      !event.undoneAt &&
      event.attemptNumber === attemptNumber &&
      (event.eventType === 'FIRST_CALL' || event.eventType === 'SECONDARY_CALL'),
  )
}

export function assertCornerSwapAllowed(_events: BoutEventRecord[], _attemptNumber: number): void {
  // Corner swap stays available during and after the bout for error correction.
}

function activeEvents(events: BoutEventRecord[]): BoutEventRecord[] {
  return events.filter((event) => !event.undoneAt)
}

function hasFirstCallForEntry(events: BoutEventRecord[], entryId: string): boolean {
  return activeEvents(events).some(
    (event) => event.eventType === 'FIRST_CALL' && event.entryId === entryId,
  )
}

export function hasActiveSecondaryCallForEntry(events: BoutEventRecord[], entryId: string): boolean {
  const active = activeEvents(events)
  const secondaryCalls = active.filter(
    (event) => event.eventType === 'SECONDARY_CALL' && event.entryId === entryId,
  )
  if (secondaryCalls.length === 0) return false
  const latest = secondaryCalls[secondaryCalls.length - 1]!
  const closedByNoShow = active.some(
    (event) =>
      event.eventType === 'BOUT_STOPPAGE' &&
      event.createdAt > latest.createdAt &&
      (event.payload as { trigger?: string } | null)?.trigger === 'NO_SHOW' &&
      (event.payload as { loserEntryId?: string } | null)?.loserEntryId === entryId,
  )
  return !closedByNoShow
}

export function assertFirstCallOrder(input: {
  corner: Corner
  entryId: string
  events: BoutEventRecord[]
  participants: BoutParticipantContext
}): void {
  const { corner, entryId, events, participants } = input

  if (hasFirstCallForEntry(events, entryId)) {
    throw new FirstCallAlreadyRecordedError()
  }

  if (corner === 'blue') {
    const redEntryId = entryIdForCorner('red', participants)
    if (redEntryId && !hasFirstCallForEntry(events, redEntryId)) {
      throw new FirstCallOrderViolationError()
    }
  }
}

export function assertSecondaryCallOrder(input: {
  entryId: string
  events: BoutEventRecord[]
  participants: BoutParticipantContext
}): void {
  const { entryId, events, participants } = input

  if (!hasFirstCallForEntry(events, entryId)) {
    throw new SecondaryCallWithoutFirstError()
  }

  const redEntryId = entryIdForCorner('red', participants)
  const blueEntryId = entryIdForCorner('blue', participants)
  if (!redEntryId || !blueEntryId) {
    throw new BothFirstCallsRequiredError()
  }
  if (!hasFirstCallForEntry(events, redEntryId) || !hasFirstCallForEntry(events, blueEntryId)) {
    throw new BothFirstCallsRequiredError()
  }

  if (hasActiveSecondaryCallForEntry(events, entryId)) {
    throw new SecondaryCallAlreadyRecordedError()
  }
}

export function assertNoShowAllowed(input: {
  entryId: string
  events: BoutEventRecord[]
  now: Date
  attemptNumber: number
}): void {
  const { entryId, events, now, attemptNumber } = input

  if (hasActiveAthleteWaitForEntry(events, entryId, attemptNumber)) {
    assertNoShowAllowedForAthleteWait({ entryId, events, now, attemptNumber })
    return
  }

  const active = activeEvents(events)
  const secondaryCalls = active.filter(
    (event) => event.eventType === 'SECONDARY_CALL' && event.entryId === entryId,
  )
  if (secondaryCalls.length === 0) {
    throw new NoShowNotAllowedError()
  }

  const latestSecondary = secondaryCalls[secondaryCalls.length - 1]!
  const deadlineAt = latestSecondary.createdAt.getTime() + SECONDARY_CALL_DURATION_MS
  if (now.getTime() < deadlineAt) {
    throw new SecondaryCallTimerActiveError()
  }
}

export function assertCallOrder(input: {
  intent: 'FIRST_CALL' | 'SECONDARY_CALL' | 'NO_SHOW' | 'CORNER_SWAP'
  entryId?: string
  corner?: Corner
  events: BoutEventRecord[]
  participants: BoutParticipantContext
  now: Date
  attemptNumber: number
}): void {
  switch (input.intent) {
    case 'CORNER_SWAP':
      assertCornerSwapAllowed(input.events, input.attemptNumber)
      return
    case 'FIRST_CALL':
      if (!input.entryId || !input.corner) return
      assertFirstCallOrder({
        corner: input.corner,
        entryId: input.entryId,
        events: input.events,
        participants: input.participants,
      })
      return
    case 'SECONDARY_CALL':
      if (!input.entryId) return
      assertSecondaryCallOrder({
        entryId: input.entryId,
        events: input.events,
        participants: input.participants,
      })
      return
    case 'NO_SHOW':
      if (!input.entryId) return
      assertNoShowAllowed({
        entryId: input.entryId,
        events: input.events,
        now: input.now,
        attemptNumber: input.attemptNumber,
      })
      return
    default:
      return
  }
}

export { SECONDARY_CALL_DURATION_MS }
