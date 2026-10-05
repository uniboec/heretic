import { uiCornerForEntryEpisode } from './assertBoutParticipantCorner'
import { nextSanctionOnLadder } from '../config/fseRules'
import {
  AthleteWaitAlreadyActiveError,
  AthleteWaitNotActiveError,
  NoShowNotAllowedError,
  SecondaryCallTimerActiveError,
} from './mat-control/errors'
import type {
  BoutEventRecord,
  BoutParticipantContext,
  Corner,
  PenaltyEventPayload,
} from './mat-control/types'
import { countLateAppearancePenaltySteps } from './lateAppearancePenalties'
import { buildPenaltyEventPayload, reduceScoreEvents } from './scoreEngine'

/** Duration after which a no-show can be recorded while waiting. */
export const ATHLETE_WAIT_NO_SHOW_MS = 120_000

export type AthleteWaitPausePayload = {
  accumulatedMs: number
  sessionMs: number
  penaltyStepsApplied: number
}

export type AthleteWaitStartPayload = {
  accumulatedMs: number
}

export type AthleteWaitTimerState = {
  entryId: string
  accumulatedMs: number
  startedAt: string | null
  isActive: boolean
  totalMs: number
  noShowAvailable: boolean
}

function activeEvents(events: BoutEventRecord[]): BoutEventRecord[] {
  return events.filter((event) => !event.undoneAt)
}

function eventsForAttempt(events: BoutEventRecord[], attemptNumber: number): BoutEventRecord[] {
  return events.filter((event) => event.attemptNumber === attemptNumber)
}

function waitEventsForEntry(events: BoutEventRecord[], entryId: string): BoutEventRecord[] {
  return activeEvents(events)
    .filter(
      (event) =>
        event.entryId === entryId &&
        (event.eventType === 'ATHLETE_WAIT_START' || event.eventType === 'ATHLETE_WAIT_END'),
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

export function resolveAthleteWaitState(input: {
  events: BoutEventRecord[]
  entryId: string
  now: Date
}): AthleteWaitTimerState | null {
  const waitEvents = waitEventsForEntry(input.events, input.entryId)
  if (waitEvents.length === 0) return null

  let accumulatedMs = 0
  let activeStart: Date | null = null

  for (const event of waitEvents) {
    if (event.eventType === 'ATHLETE_WAIT_START') {
      const payload = event.payload as AthleteWaitStartPayload | null
      accumulatedMs = payload?.accumulatedMs ?? 0
      activeStart = event.createdAt
      continue
    }

    const payload = event.payload as AthleteWaitPausePayload | null
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
      noShowAvailable: totalMs >= ATHLETE_WAIT_NO_SHOW_MS,
    }
  }

  if (accumulatedMs <= 0) return null

  return {
    entryId: input.entryId,
    accumulatedMs,
    startedAt: null,
    isActive: false,
    totalMs: accumulatedMs,
    noShowAvailable: false,
  }
}

export function latestAthleteWaitStartForEntry(
  events: BoutEventRecord[],
  entryId: string,
): BoutEventRecord | null {
  const starts = activeEvents(events).filter(
    (event) => event.eventType === 'ATHLETE_WAIT_START' && event.entryId === entryId,
  )
  return starts.length > 0 ? starts[starts.length - 1]! : null
}

export function hasActiveAthleteWaitForEntry(
  events: BoutEventRecord[],
  entryId: string,
  attemptNumber: number,
): boolean {
  const state = resolveAthleteWaitState({
    events: eventsForAttempt(events, attemptNumber),
    entryId,
    now: new Date(),
  })
  return state?.isActive ?? false
}

export function hasAnyActiveAthleteWait(events: BoutEventRecord[], attemptNumber: number): boolean {
  const attemptEvents = eventsForAttempt(events, attemptNumber)
  const entryIds = new Set(
    activeEvents(attemptEvents)
      .filter(
        (event) =>
          event.entryId &&
          (event.eventType === 'ATHLETE_WAIT_START' || event.eventType === 'ATHLETE_WAIT_END'),
      )
      .map((event) => event.entryId!),
  )
  for (const entryId of entryIds) {
    if (hasActiveAthleteWaitForEntry(attemptEvents, entryId, attemptNumber)) {
      return true
    }
  }
  return false
}

export function getResumeBaselineMs(
  events: BoutEventRecord[],
  entryId: string,
  attemptNumber: number,
): number {
  return (
    resolveAthleteWaitState({
      events: eventsForAttempt(events, attemptNumber),
      entryId,
      now: new Date(),
    })?.totalMs ?? 0
  )
}

export function assertAthleteWaitStart(input: {
  entryId: string
  events: BoutEventRecord[]
  attemptNumber: number
}): void {
  if (hasActiveAthleteWaitForEntry(input.events, input.entryId, input.attemptNumber)) {
    throw new AthleteWaitAlreadyActiveError()
  }
}

export function assertAthleteWaitPause(input: {
  entryId: string
  events: BoutEventRecord[]
  attemptNumber: number
}): void {
  if (!hasActiveAthleteWaitForEntry(input.events, input.entryId, input.attemptNumber)) {
    throw new AthleteWaitNotActiveError()
  }
}

export function computeActiveAthleteWaitTotals(input: {
  events: BoutEventRecord[]
  entryId: string
  now: Date
  attemptNumber: number
}): { accumulatedMs: number; sessionMs: number; totalMs: number } {
  const attemptEvents = eventsForAttempt(input.events, input.attemptNumber)
  const latestStart = latestAthleteWaitStartForEntry(attemptEvents, input.entryId)
  if (!latestStart) {
    return { accumulatedMs: 0, sessionMs: 0, totalMs: 0 }
  }

  const payload = latestStart.payload as AthleteWaitStartPayload | null
  const accumulatedMs = payload?.accumulatedMs ?? 0
  const sessionMs = Math.max(0, input.now.getTime() - latestStart.createdAt.getTime())
  return {
    accumulatedMs,
    sessionMs,
    totalMs: accumulatedMs + sessionMs,
  }
}

export function countLateAppearancePenaltiesInEpisode(input: {
  events: BoutEventRecord[]
  entryId: string
  attemptNumber: number
}): number {
  const attemptEvents = eventsForAttempt(input.events, input.attemptNumber)
  const latestStart = latestAthleteWaitStartForEntry(attemptEvents, input.entryId)
  if (!latestStart) return 0

  return activeEvents(attemptEvents).filter((event) => {
    if (event.eventType !== 'PENALTY' || event.entryId !== input.entryId) return false
    if (event.createdAt < latestStart.createdAt) return false
    const payload = event.payload as PenaltyEventPayload | null
    return payload?.ladder === 'GENERAL'
  }).length
}

export function assertNoShowAllowedForAthleteWait(input: {
  entryId: string
  events: BoutEventRecord[]
  now: Date
  attemptNumber: number
}): void {
  const state = resolveAthleteWaitState({
    events: eventsForAttempt(input.events, input.attemptNumber),
    entryId: input.entryId,
    now: input.now,
  })

  if (!state?.isActive) {
    throw new NoShowNotAllowedError('Неявку можно зафиксировать только во время ожидания спортсмена')
  }

  if (state.totalMs < ATHLETE_WAIT_NO_SHOW_MS) {
    throw new SecondaryCallTimerActiveError(
      `Неявку можно зафиксировать через ${Math.ceil((ATHLETE_WAIT_NO_SHOW_MS - state.totalMs) / 1000)} сек`,
    )
  }
}

export function buildLateAppearancePenaltyPayloads(input: {
  events: BoutEventRecord[]
  corner: Corner
  period: BoutEventRecord['period']
  attemptNumber: number
  waitedMs: number
  stepsToApply: number
}): PenaltyEventPayload[] {
  if (input.stepsToApply <= 0) return []

  const state = reduceScoreEvents(input.events, input.period, input.attemptNumber)
  let currentSanction = state.generalDisciplinaryLadder[input.corner]
  const payloads: PenaltyEventPayload[] = []

  for (let i = 0; i < input.stepsToApply; i++) {
    const nextSanction = nextSanctionOnLadder('GENERAL', currentSanction)
    if (nextSanction === 'DISQUALIFICATION') {
      break
    }
    payloads.push(buildPenaltyEventPayload({ ladder: 'GENERAL', sanction: nextSanction }))
    currentSanction = nextSanction
  }

  return payloads
}

function waitEntryIds(
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
      (event.eventType === 'ATHLETE_WAIT_START' || event.eventType === 'ATHLETE_WAIT_END')
    ) {
      entryIds.add(event.entryId)
    }
  }
  return [...entryIds]
}

export function listOpenAthleteWaitCloseSpecs(
  events: BoutEventRecord[],
  attemptNumber: number,
): Array<{ entryId: string; corner: Corner }> {
  const attemptEvents = activeEvents(eventsForAttempt(events, attemptNumber))
  const entryIds = new Set(
    attemptEvents
      .filter((event) => event.eventType === 'ATHLETE_WAIT_START' && event.entryId)
      .map((event) => event.entryId!),
  )

  const specs: Array<{ entryId: string; corner: Corner }> = []
  for (const entryId of entryIds) {
    if (!hasActiveAthleteWaitForEntry(attemptEvents, entryId, attemptNumber)) continue
    const latestStart = attemptEvents
      .filter((event) => event.eventType === 'ATHLETE_WAIT_START' && event.entryId === entryId)
      .at(-1)
    if (latestStart?.cornerAtEvent) {
      specs.push({ entryId, corner: latestStart.cornerAtEvent })
    }
  }
  return specs
}

export function computeAthleteWaitTimers(input: {
  events: BoutEventRecord[]
  participants: BoutParticipantContext
  attemptNumber: number
  now: Date
}): Partial<Record<Corner, AthleteWaitTimerState>> {
  const attemptEvents = input.events.filter((event) => event.attemptNumber === input.attemptNumber)
  const waits: Partial<Record<Corner, AthleteWaitTimerState>> = {}

  for (const entryId of waitEntryIds(attemptEvents, input.participants)) {
    const state = resolveAthleteWaitState({
      events: attemptEvents,
      entryId,
      now: input.now,
    })
    if (!state) continue

    const corner = uiCornerForEntryEpisode(
      attemptEvents,
      entryId,
      input.participants,
      'ATHLETE_WAIT_START',
    )
    if (corner) {
      waits[corner] = state
    }
  }

  return waits
}
