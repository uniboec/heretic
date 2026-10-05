import { nextSanctionOnLadder, type PenaltySanction } from '../config/fseRules'
import { CommandNotAllowedError } from './mat-control/errors'
import type { BoutEventRecord, BoutPeriod, Corner, PenaltyEventPayload } from './mat-control/types'
import type { MatControlExecution } from './mat-control/types'
import { computeClockElapsedMs } from './stopClockAt'
import { buildPenaltyEventPayload, reduceScoreEvents } from './scoreEngine'

/** Interval between automatic passivity ladder steps while the timer is active. */
export const PASSIVITY_PENALTY_INTERVAL_MS = 20_000

function activeEvents(events: BoutEventRecord[]): BoutEventRecord[] {
  return events.filter((event) => !event.undoneAt)
}

export function countPassivityPenaltiesInEpisode(input: {
  events: BoutEventRecord[]
  corner: Corner
  passivityStartedAt: Date
}): number {
  return activeEvents(input.events).filter((event) => {
    if (event.eventType !== 'PENALTY' || event.cornerAtEvent !== input.corner) return false
    const payload = event.payload as PenaltyEventPayload | null
    return (
      payload?.ladder === 'PASSIVITY' && event.createdAt.getTime() >= input.passivityStartedAt.getTime()
    )
  }).length
}

export function countPassivityPenaltyStepsDue(elapsedMs: number, penaltiesApplied: number): number {
  const totalDue = Math.floor(elapsedMs / PASSIVITY_PENALTY_INTERVAL_MS)
  return Math.max(0, totalDue - penaltiesApplied)
}

export function msUntilNextPassivityPenalty(elapsedMs: number, penaltiesApplied: number): number | null {
  const nextThreshold = (penaltiesApplied + 1) * PASSIVITY_PENALTY_INTERVAL_MS
  if (elapsedMs >= nextThreshold) return 0
  return nextThreshold - elapsedMs
}

/** Elapsed passivity time follows bout clock — pauses when fight clock is stopped. */
export function resolvePassivityElapsedMs(input: {
  passivityStartBoutElapsedMs: number
  execution: MatControlExecution
  now: Date
}): number {
  const currentMs = computeClockElapsedMs(input.execution, input.now)
  return Math.max(0, currentMs - input.passivityStartBoutElapsedMs)
}

export function isPassivityDisqualificationDueFromElapsed(input: {
  elapsedMs: number
  penaltiesApplied: number
  nextSanction: PenaltySanction | null
}): boolean {
  return (
    countPassivityPenaltyStepsDue(input.elapsedMs, input.penaltiesApplied) > 0 &&
    input.nextSanction === 'DISQUALIFICATION'
  )
}

export function isPassivityDisqualificationDue(input: {
  events: BoutEventRecord[]
  corner: Corner
  period: BoutPeriod
  attemptNumber: number
  elapsedMs: number
  penaltiesApplied: number
}): boolean {
  const state = reduceScoreEvents(input.events, input.period, input.attemptNumber)
  const nextSanction = nextSanctionOnLadder('PASSIVITY', state.passivityLadder[input.corner])
  return isPassivityDisqualificationDueFromElapsed({
    elapsedMs: input.elapsedMs,
    penaltiesApplied: input.penaltiesApplied,
    nextSanction,
  })
}

export function buildPassivityPenaltyPayloads(input: {
  events: BoutEventRecord[]
  corner: Corner
  period: BoutEventRecord['period']
  attemptNumber: number
  stepsToApply: number
}): PenaltyEventPayload[] {
  if (input.stepsToApply <= 0) return []

  const state = reduceScoreEvents(input.events, input.period, input.attemptNumber)
  let currentSanction = state.passivityLadder[input.corner]
  const payloads: PenaltyEventPayload[] = []

  for (let i = 0; i < input.stepsToApply; i++) {
    const nextSanction = nextSanctionOnLadder('PASSIVITY', currentSanction)
    if (nextSanction === 'DISQUALIFICATION') {
      break
    }
    payloads.push(buildPenaltyEventPayload({ ladder: 'PASSIVITY', sanction: nextSanction }))
    currentSanction = nextSanction
  }

  return payloads
}

function latestOpenPassivityStart(
  events: BoutEventRecord[],
  attemptNumber: number,
): BoutEventRecord | null {
  const scoped = activeEvents(events.filter((event) => event.attemptNumber === attemptNumber))
  const starts = scoped.filter((event) => event.eventType === 'PASSIVITY_START')
  if (starts.length === 0) return null
  const latestStart = starts[starts.length - 1]!
  const endedAfter = scoped.some(
    (event) => event.eventType === 'PASSIVITY_END' && event.createdAt > latestStart.createdAt,
  )
  return endedAfter ? null : latestStart
}

export function resolvePassivityDuePenaltyPayloads(input: {
  events: BoutEventRecord[]
  corner: Corner
  entryId: string
  attemptNumber: number
  period: BoutEventRecord['period']
  execution: MatControlExecution
  now: Date
}): { payloads: PenaltyEventPayload[]; disqualificationDue: boolean } {
  const passivityStart = latestOpenPassivityStart(input.events, input.attemptNumber)
  if (
    !passivityStart?.cornerAtEvent ||
    passivityStart.cornerAtEvent !== input.corner ||
    passivityStart.entryId !== input.entryId
  ) {
    throw new CommandNotAllowedError('Пассивность не активна для этого угла')
  }

  const elapsedMs = resolvePassivityElapsedMs({
    passivityStartBoutElapsedMs: passivityStart.boutElapsedMs ?? 0,
    execution: input.execution,
    now: input.now,
  })
  const penaltiesApplied = countPassivityPenaltiesInEpisode({
    events: input.events,
    corner: input.corner,
    passivityStartedAt: passivityStart.createdAt,
  })
  const stepsToApply = countPassivityPenaltyStepsDue(elapsedMs, penaltiesApplied)
  const disqualificationDue = isPassivityDisqualificationDue({
    events: input.events,
    corner: input.corner,
    period: input.period,
    attemptNumber: input.attemptNumber,
    elapsedMs,
    penaltiesApplied,
  })

  return {
    payloads: buildPassivityPenaltyPayloads({
      events: input.events,
      corner: input.corner,
      period: input.period,
      attemptNumber: input.attemptNumber,
      stepsToApply,
    }),
    disqualificationDue,
  }
}
