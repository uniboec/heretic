import { uiCornerForEntryEpisode } from './assertBoutParticipantCorner'
import {
  AthleteDoctorAlreadyActiveError,
  AthleteDoctorNotActiveError,
  DoctorRemovalNotAllowedError,
} from './mat-control/errors'
import type { BoutEventRecord, BoutParticipantContext, Corner } from './mat-control/types'

/** Cumulative doctor time after which removal (Н.П.Б.) is available. */
export const ATHLETE_DOCTOR_REMOVAL_MS = 120_000

export type AthleteDoctorPausePayload = {
  accumulatedMs: number
  sessionMs: number
}

export type AthleteDoctorStartPayload = {
  accumulatedMs: number
}

export type AthleteDoctorTimerState = {
  entryId: string
  accumulatedMs: number
  startedAt: string | null
  isActive: boolean
  totalMs: number
  removalAvailable: boolean
}

function activeEvents(events: BoutEventRecord[]): BoutEventRecord[] {
  return events.filter((event) => !event.undoneAt)
}

function eventsForAttempt(events: BoutEventRecord[], attemptNumber: number): BoutEventRecord[] {
  return events.filter((event) => event.attemptNumber === attemptNumber)
}

function doctorEventsForEntry(events: BoutEventRecord[], entryId: string): BoutEventRecord[] {
  return activeEvents(events)
    .filter(
      (event) =>
        event.entryId === entryId &&
        (event.eventType === 'ATHLETE_DOCTOR_START' || event.eventType === 'ATHLETE_DOCTOR_END'),
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

export function resolveAthleteDoctorState(input: {
  events: BoutEventRecord[]
  entryId: string
  now: Date
}): AthleteDoctorTimerState | null {
  const doctorEvents = doctorEventsForEntry(input.events, input.entryId)
  if (doctorEvents.length === 0) return null

  let accumulatedMs = 0
  let activeStart: Date | null = null

  for (const event of doctorEvents) {
    if (event.eventType === 'ATHLETE_DOCTOR_START') {
      const payload = event.payload as AthleteDoctorStartPayload | null
      accumulatedMs = payload?.accumulatedMs ?? 0
      activeStart = event.createdAt
      continue
    }

    const payload = event.payload as AthleteDoctorPausePayload | null
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
      removalAvailable: totalMs >= ATHLETE_DOCTOR_REMOVAL_MS,
    }
  }

  if (accumulatedMs <= 0) return null

  return {
    entryId: input.entryId,
    accumulatedMs,
    startedAt: null,
    isActive: false,
    totalMs: accumulatedMs,
    removalAvailable: accumulatedMs >= ATHLETE_DOCTOR_REMOVAL_MS,
  }
}

export function hasActiveAthleteDoctorForEntry(
  events: BoutEventRecord[],
  entryId: string,
  attemptNumber: number,
): boolean {
  const state = resolveAthleteDoctorState({
    events: eventsForAttempt(events, attemptNumber),
    entryId,
    now: new Date(),
  })
  return state?.isActive ?? false
}

export function hasAnyActiveAthleteDoctor(events: BoutEventRecord[], attemptNumber: number): boolean {
  const attemptEvents = eventsForAttempt(events, attemptNumber)
  const entryIds = new Set(
    activeEvents(attemptEvents)
      .filter(
        (event) =>
          event.entryId &&
          (event.eventType === 'ATHLETE_DOCTOR_START' || event.eventType === 'ATHLETE_DOCTOR_END'),
      )
      .map((event) => event.entryId!),
  )
  for (const entryId of entryIds) {
    if (hasActiveAthleteDoctorForEntry(attemptEvents, entryId, attemptNumber)) {
      return true
    }
  }
  return false
}

export function getDoctorResumeBaselineMs(
  events: BoutEventRecord[],
  entryId: string,
  attemptNumber: number,
): number {
  return (
    resolveAthleteDoctorState({
      events: eventsForAttempt(events, attemptNumber),
      entryId,
      now: new Date(),
    })?.totalMs ?? 0
  )
}

export function assertAthleteDoctorStart(input: {
  entryId: string
  events: BoutEventRecord[]
  attemptNumber: number
}): void {
  if (hasActiveAthleteDoctorForEntry(input.events, input.entryId, input.attemptNumber)) {
    throw new AthleteDoctorAlreadyActiveError()
  }
}

export function assertAthleteDoctorPause(input: {
  entryId: string
  events: BoutEventRecord[]
  attemptNumber: number
}): void {
  if (!hasActiveAthleteDoctorForEntry(input.events, input.entryId, input.attemptNumber)) {
    throw new AthleteDoctorNotActiveError()
  }
}

export function computeActiveAthleteDoctorTotals(input: {
  events: BoutEventRecord[]
  entryId: string
  now: Date
  attemptNumber: number
}): { accumulatedMs: number; sessionMs: number; totalMs: number } {
  const latestStart = activeEvents(eventsForAttempt(input.events, input.attemptNumber))
    .filter((event) => event.eventType === 'ATHLETE_DOCTOR_START' && event.entryId === input.entryId)
    .at(-1)

  if (!latestStart) {
    return { accumulatedMs: 0, sessionMs: 0, totalMs: 0 }
  }

  const payload = latestStart.payload as AthleteDoctorStartPayload | null
  const accumulatedMs = payload?.accumulatedMs ?? 0
  const sessionMs = Math.max(0, input.now.getTime() - latestStart.createdAt.getTime())
  return {
    accumulatedMs,
    sessionMs,
    totalMs: accumulatedMs + sessionMs,
  }
}

export function assertDoctorRemovalAllowed(input: {
  entryId: string
  events: BoutEventRecord[]
  now: Date
  attemptNumber: number
}): void {
  const state = resolveAthleteDoctorState({
    events: eventsForAttempt(input.events, input.attemptNumber),
    entryId: input.entryId,
    now: input.now,
  })

  if (!state || state.totalMs < ATHLETE_DOCTOR_REMOVAL_MS) {
    throw new DoctorRemovalNotAllowedError()
  }
}

function doctorEntryIds(
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
      (event.eventType === 'ATHLETE_DOCTOR_START' || event.eventType === 'ATHLETE_DOCTOR_END')
    ) {
      entryIds.add(event.entryId)
    }
  }
  return [...entryIds]
}

export function computeAthleteDoctorTimers(input: {
  events: BoutEventRecord[]
  participants: BoutParticipantContext
  attemptNumber: number
  now: Date
}): Partial<Record<Corner, AthleteDoctorTimerState>> {
  const attemptEvents = input.events.filter((event) => event.attemptNumber === input.attemptNumber)
  const visits: Partial<Record<Corner, AthleteDoctorTimerState>> = {}

  for (const entryId of doctorEntryIds(attemptEvents, input.participants)) {
    const state = resolveAthleteDoctorState({
      events: attemptEvents,
      entryId,
      now: input.now,
    })
    if (!state) continue

    const corner = uiCornerForEntryEpisode(
      attemptEvents,
      entryId,
      input.participants,
      'ATHLETE_DOCTOR_START',
    )
    if (corner) {
      visits[corner] = state
    }
  }

  return visits
}

export function listOpenAthleteDoctorCloseSpecs(
  events: BoutEventRecord[],
  attemptNumber: number,
): Array<{ entryId: string; corner: Corner }> {
  const attemptEvents = events.filter(
    (event) => !event.undoneAt && event.attemptNumber === attemptNumber,
  )
  const entryIds = new Set(
    attemptEvents
      .filter((event) => event.eventType === 'ATHLETE_DOCTOR_START' && event.entryId)
      .map((event) => event.entryId!),
  )

  const specs: Array<{ entryId: string; corner: Corner }> = []
  for (const entryId of entryIds) {
    if (!hasActiveAthleteDoctorForEntry(attemptEvents, entryId, attemptNumber)) continue
    const latestStart = attemptEvents
      .filter((event) => event.eventType === 'ATHLETE_DOCTOR_START' && event.entryId === entryId)
      .at(-1)
    if (latestStart?.cornerAtEvent) {
      specs.push({ entryId, corner: latestStart.cornerAtEvent })
    }
  }
  return specs
}
