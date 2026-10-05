import { uiCornerForEntryEpisode } from './assertBoutParticipantCorner'
import {
  AthleteEquipmentAlreadyActiveError,
  AthleteEquipmentNotActiveError,
  EquipmentDisqualifyNotAllowedError,
} from './mat-control/errors'
import type { BoutEventRecord, BoutParticipantContext, Corner } from './mat-control/types'

/** Cumulative equipment-correction time after which disqualification is available. */
export const ATHLETE_EQUIPMENT_TIMEOUT_MS = 120_000

export type AthleteEquipmentPausePayload = {
  accumulatedMs: number
  sessionMs: number
}

export type AthleteEquipmentStartPayload = {
  accumulatedMs: number
}

export type AthleteEquipmentTimerState = {
  entryId: string
  accumulatedMs: number
  startedAt: string | null
  isActive: boolean
  totalMs: number
  disqualifyAvailable: boolean
}

function activeEvents(events: BoutEventRecord[]): BoutEventRecord[] {
  return events.filter((event) => !event.undoneAt)
}

function eventsForAttempt(events: BoutEventRecord[], attemptNumber: number): BoutEventRecord[] {
  return events.filter((event) => event.attemptNumber === attemptNumber)
}

function equipmentEventsForEntry(events: BoutEventRecord[], entryId: string): BoutEventRecord[] {
  return activeEvents(events)
    .filter(
      (event) =>
        event.entryId === entryId &&
        (event.eventType === 'ATHLETE_EQUIPMENT_START' ||
          event.eventType === 'ATHLETE_EQUIPMENT_END'),
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

export function resolveAthleteEquipmentState(input: {
  events: BoutEventRecord[]
  entryId: string
  now: Date
}): AthleteEquipmentTimerState | null {
  const equipmentEvents = equipmentEventsForEntry(input.events, input.entryId)
  if (equipmentEvents.length === 0) return null

  let accumulatedMs = 0
  let activeStart: Date | null = null

  for (const event of equipmentEvents) {
    if (event.eventType === 'ATHLETE_EQUIPMENT_START') {
      const payload = event.payload as AthleteEquipmentStartPayload | null
      accumulatedMs = payload?.accumulatedMs ?? 0
      activeStart = event.createdAt
      continue
    }

    const payload = event.payload as AthleteEquipmentPausePayload | null
    accumulatedMs = payload?.accumulatedMs ?? accumulatedMs
    activeStart = null
  }

  if (activeStart) {
    const sessionMs = Math.max(0, input.now.getTime() - activeStart.getTime())
    const totalMs = accumulatedMs + sessionMs
    return {
      entryId: input.entryId,
      accumulatedMs,
      startedAt: activeStart.toISOString(),
      isActive: true,
      totalMs,
      disqualifyAvailable: totalMs >= ATHLETE_EQUIPMENT_TIMEOUT_MS,
    }
  }

  if (accumulatedMs <= 0) return null

  return {
    entryId: input.entryId,
    accumulatedMs,
    startedAt: null,
    isActive: false,
    totalMs: accumulatedMs,
    disqualifyAvailable: accumulatedMs >= ATHLETE_EQUIPMENT_TIMEOUT_MS,
  }
}

export function hasActiveAthleteEquipmentForEntry(
  events: BoutEventRecord[],
  entryId: string,
  attemptNumber: number,
): boolean {
  const state = resolveAthleteEquipmentState({
    events: eventsForAttempt(events, attemptNumber),
    entryId,
    now: new Date(),
  })
  return state?.isActive ?? false
}

export function hasAnyActiveAthleteEquipment(
  events: BoutEventRecord[],
  attemptNumber: number,
): boolean {
  const attemptEvents = eventsForAttempt(events, attemptNumber)
  const entryIds = new Set(
    activeEvents(attemptEvents)
      .filter(
        (event) =>
          event.entryId &&
          (event.eventType === 'ATHLETE_EQUIPMENT_START' ||
            event.eventType === 'ATHLETE_EQUIPMENT_END'),
      )
      .map((event) => event.entryId!),
  )
  for (const entryId of entryIds) {
    if (hasActiveAthleteEquipmentForEntry(attemptEvents, entryId, attemptNumber)) {
      return true
    }
  }
  return false
}

export function getEquipmentResumeBaselineMs(
  events: BoutEventRecord[],
  entryId: string,
  attemptNumber: number,
): number {
  return (
    resolveAthleteEquipmentState({
      events: eventsForAttempt(events, attemptNumber),
      entryId,
      now: new Date(),
    })?.totalMs ?? 0
  )
}

export function assertAthleteEquipmentStart(input: {
  entryId: string
  events: BoutEventRecord[]
  attemptNumber: number
}): void {
  if (hasActiveAthleteEquipmentForEntry(input.events, input.entryId, input.attemptNumber)) {
    throw new AthleteEquipmentAlreadyActiveError()
  }
}

export function assertAthleteEquipmentPause(input: {
  entryId: string
  events: BoutEventRecord[]
  attemptNumber: number
}): void {
  if (!hasActiveAthleteEquipmentForEntry(input.events, input.entryId, input.attemptNumber)) {
    throw new AthleteEquipmentNotActiveError()
  }
}

export function computeActiveAthleteEquipmentTotals(input: {
  events: BoutEventRecord[]
  entryId: string
  now: Date
  attemptNumber: number
}): { accumulatedMs: number; sessionMs: number; totalMs: number } {
  const latestStart = activeEvents(eventsForAttempt(input.events, input.attemptNumber))
    .filter(
      (event) => event.eventType === 'ATHLETE_EQUIPMENT_START' && event.entryId === input.entryId,
    )
    .at(-1)

  if (!latestStart) {
    return { accumulatedMs: 0, sessionMs: 0, totalMs: 0 }
  }

  const payload = latestStart.payload as AthleteEquipmentStartPayload | null
  const accumulatedMs = payload?.accumulatedMs ?? 0
  const sessionMs = Math.max(0, input.now.getTime() - latestStart.createdAt.getTime())
  return {
    accumulatedMs,
    sessionMs,
    totalMs: accumulatedMs + sessionMs,
  }
}

export function assertEquipmentDisqualifyAllowed(input: {
  entryId: string
  events: BoutEventRecord[]
  now: Date
  attemptNumber: number
}): void {
  const state = resolveAthleteEquipmentState({
    events: eventsForAttempt(input.events, input.attemptNumber),
    entryId: input.entryId,
    now: input.now,
  })

  if (!state || state.totalMs < ATHLETE_EQUIPMENT_TIMEOUT_MS) {
    throw new EquipmentDisqualifyNotAllowedError()
  }
}

function equipmentEntryIds(
  events: BoutEventRecord[],
  participants: BoutParticipantContext,
): string[] {
  const entryIds = new Set<string>()
  if (participants.redEntryId) entryIds.add(participants.redEntryId)
  if (participants.blueEntryId) entryIds.add(participants.blueEntryId)
  for (const event of events) {
    if (
      !event.undoneAt &&
      event.entryId &&
      (event.eventType === 'ATHLETE_EQUIPMENT_START' ||
        event.eventType === 'ATHLETE_EQUIPMENT_END')
    ) {
      entryIds.add(event.entryId)
    }
  }
  return [...entryIds]
}

export function computeAthleteEquipmentTimers(input: {
  events: BoutEventRecord[]
  participants: BoutParticipantContext
  attemptNumber: number
  now: Date
}): Partial<Record<Corner, AthleteEquipmentTimerState>> {
  const attemptEvents = input.events.filter((event) => event.attemptNumber === input.attemptNumber)
  const corrections: Partial<Record<Corner, AthleteEquipmentTimerState>> = {}

  for (const entryId of equipmentEntryIds(attemptEvents, input.participants)) {
    const state = resolveAthleteEquipmentState({
      events: attemptEvents,
      entryId,
      now: input.now,
    })
    if (!state) continue

    const corner = uiCornerForEntryEpisode(
      attemptEvents,
      entryId,
      input.participants,
      'ATHLETE_EQUIPMENT_START',
    )
    if (corner) {
      corrections[corner] = state
    }
  }

  return corrections
}

export function listOpenAthleteEquipmentCloseSpecs(
  events: BoutEventRecord[],
  attemptNumber: number,
): Array<{ entryId: string; corner: Corner }> {
  const attemptEvents = events.filter(
    (event) => !event.undoneAt && event.attemptNumber === attemptNumber,
  )
  const entryIds = new Set(
    attemptEvents
      .filter((event) => event.eventType === 'ATHLETE_EQUIPMENT_START' && event.entryId)
      .map((event) => event.entryId!),
  )

  const specs: Array<{ entryId: string; corner: Corner }> = []
  for (const entryId of entryIds) {
    if (!hasActiveAthleteEquipmentForEntry(attemptEvents, entryId, attemptNumber)) continue
    const latestStart = attemptEvents
      .filter((event) => event.eventType === 'ATHLETE_EQUIPMENT_START' && event.entryId === entryId)
      .at(-1)
    if (latestStart?.cornerAtEvent) {
      specs.push({ entryId, corner: latestStart.cornerAtEvent })
    }
  }
  return specs
}
