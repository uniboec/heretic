import { SECONDARY_CALL_DURATION_MS, hasActiveSecondaryCallForEntry } from './assertCallOrder'
import {
  computeAthleteDoctorTimers,
  listOpenAthleteDoctorCloseSpecs,
  type AthleteDoctorTimerState,
} from './athleteDoctorVisit'
import {
  computeAthleteEquipmentTimers,
  listOpenAthleteEquipmentCloseSpecs,
  type AthleteEquipmentTimerState,
} from './athleteEquipmentCorrection'
import {
  computeAthleteWaitTimers,
  listOpenAthleteWaitCloseSpecs,
  type AthleteWaitTimerState,
} from './athleteWait'
import { nextSanctionOnLadder, type PenaltySanction } from '../config/fseRules'
import {
  countPassivityPenaltiesInEpisode,
  isPassivityDisqualificationDueFromElapsed,
  msUntilNextPassivityPenalty,
  resolvePassivityElapsedMs,
} from './passivityPenalties'
import { reduceScoreEvents } from './scoreEngine'
import { entryIdForCorner } from './assertBoutParticipantCorner'
import type {
  BoutEventRecord,
  BoutParticipantContext,
  Corner,
  MatControlExecution,
} from './mat-control/types'

export type SecondaryCallTimerState = {
  entryId: string
  startedAt: string
  deadlineAt: string
  remainingMs: number
}

export type AuxiliaryTimersSnapshot = {
  athleteDoctorVisits?: Partial<Record<Corner, AthleteDoctorTimerState>>
  athleteEquipmentCorrections?: Partial<Record<Corner, AthleteEquipmentTimerState>>
  athleteWaits?: Partial<Record<Corner, AthleteWaitTimerState>>
  secondaryCalls?: Partial<Record<Corner, SecondaryCallTimerState>>
  passivity?: {
    startedAt: string
    startBoutElapsedMs: number
    entryId: string
    corner: Corner
    elapsedMs: number
    penaltiesApplied: number
    nextPenaltyInMs: number | null
    nextSanction: PenaltySanction | null
    disqualificationDue: boolean
  }
}

function activeEvents(events: BoutEventRecord[]): BoutEventRecord[] {
  return events.filter((event) => !event.undoneAt)
}

function eventsForAttempt(events: BoutEventRecord[], attemptNumber: number): BoutEventRecord[] {
  return events.filter((event) => event.attemptNumber === attemptNumber)
}

function latestOpenEpisode(
  events: BoutEventRecord[],
  startType: BoutEventRecord['eventType'],
  endType: BoutEventRecord['eventType'],
): BoutEventRecord | null {
  const active = activeEvents(events)
  const starts = active.filter((event) => event.eventType === startType)
  if (starts.length === 0) return null
  const latestStart = starts[starts.length - 1]!
  const endedAfter = active.some(
    (event) => event.eventType === endType && event.createdAt > latestStart.createdAt,
  )
  return endedAfter ? null : latestStart
}

export type OpenAuxiliaryCloseIntent =
  | 'PASSIVITY_END'
  | 'ATHLETE_WAIT_END'
  | 'ATHLETE_DOCTOR_END'
  | 'ATHLETE_EQUIPMENT_END'

export type AuxiliaryCloseSpec = {
  intent: OpenAuxiliaryCloseIntent
  entryId: string | null
  corner: Corner | null
}

/** Open auxiliary episodes for the given attempt (used to auto-close on bout reset). */
export function listOpenAuxiliaryCloseSpecs(
  events: BoutEventRecord[],
  attemptNumber: number,
): AuxiliaryCloseSpec[] {
  const scoped = activeEvents(eventsForAttempt(events, attemptNumber))
  const specs: AuxiliaryCloseSpec[] = []
  const passivityStart = latestOpenEpisode(scoped, 'PASSIVITY_START', 'PASSIVITY_END')
  if (passivityStart?.entryId && passivityStart.cornerAtEvent) {
    specs.push({
      intent: 'PASSIVITY_END',
      entryId: passivityStart.entryId,
      corner: passivityStart.cornerAtEvent,
    })
  }
  for (const waitSpec of listOpenAthleteWaitCloseSpecs(events, attemptNumber)) {
    specs.push({
      intent: 'ATHLETE_WAIT_END',
      entryId: waitSpec.entryId,
      corner: waitSpec.corner,
    })
  }
  for (const doctorSpec of listOpenAthleteDoctorCloseSpecs(events, attemptNumber)) {
    specs.push({
      intent: 'ATHLETE_DOCTOR_END',
      entryId: doctorSpec.entryId,
      corner: doctorSpec.corner,
    })
  }
  for (const equipmentSpec of listOpenAthleteEquipmentCloseSpecs(events, attemptNumber)) {
    specs.push({
      intent: 'ATHLETE_EQUIPMENT_END',
      entryId: equipmentSpec.entryId,
      corner: equipmentSpec.corner,
    })
  }
  return specs
}

export function computeAuxiliaryTimers(input: {
  events: BoutEventRecord[]
  participants: BoutParticipantContext
  attemptNumber: number
  execution: Pick<
    MatControlExecution,
    'boutPhase' | 'clockState' | 'clockStartedAt' | 'clockElapsedBeforeStartMs'
  >
  now: Date
}): AuxiliaryTimersSnapshot {
  const attemptEvents = eventsForAttempt(input.events, input.attemptNumber)
  const snapshot: AuxiliaryTimersSnapshot = {}
  const secondaryCalls: Partial<Record<Corner, SecondaryCallTimerState>> = {}

  for (const corner of ['red', 'blue'] as const) {
    const entryId = entryIdForCorner(corner, input.participants)
    if (!entryId || !hasActiveSecondaryCallForEntry(attemptEvents, entryId)) continue

    const secondaryEvents = activeEvents(attemptEvents).filter(
      (event) => event.eventType === 'SECONDARY_CALL' && event.entryId === entryId,
    )
    const latest = secondaryEvents[secondaryEvents.length - 1]!
    const deadlineAt = new Date(latest.createdAt.getTime() + SECONDARY_CALL_DURATION_MS)
    secondaryCalls[corner] = {
      entryId,
      startedAt: latest.createdAt.toISOString(),
      deadlineAt: deadlineAt.toISOString(),
      remainingMs: Math.max(0, deadlineAt.getTime() - input.now.getTime()),
    }
  }

  if (Object.keys(secondaryCalls).length > 0) {
    snapshot.secondaryCalls = secondaryCalls
  }

  const athleteWaits = computeAthleteWaitTimers({
    events: input.events,
    participants: input.participants,
    attemptNumber: input.attemptNumber,
    now: input.now,
  })
  if (Object.keys(athleteWaits).length > 0) {
    snapshot.athleteWaits = athleteWaits
  }

  const athleteDoctorVisits = computeAthleteDoctorTimers({
    events: input.events,
    participants: input.participants,
    attemptNumber: input.attemptNumber,
    now: input.now,
  })
  if (Object.keys(athleteDoctorVisits).length > 0) {
    snapshot.athleteDoctorVisits = athleteDoctorVisits
  }

  const athleteEquipmentCorrections = computeAthleteEquipmentTimers({
    events: input.events,
    participants: input.participants,
    attemptNumber: input.attemptNumber,
    now: input.now,
  })
  if (Object.keys(athleteEquipmentCorrections).length > 0) {
    snapshot.athleteEquipmentCorrections = athleteEquipmentCorrections
  }

  const passivityStart = latestOpenEpisode(attemptEvents, 'PASSIVITY_START', 'PASSIVITY_END')
  if (
    input.execution.boutPhase === 'live' &&
    passivityStart?.entryId &&
    passivityStart.cornerAtEvent
  ) {
    const startBoutElapsedMs = passivityStart.boutElapsedMs ?? 0
    const elapsedMs = resolvePassivityElapsedMs({
      passivityStartBoutElapsedMs: startBoutElapsedMs,
      execution: input.execution as MatControlExecution,
      now: input.now,
    })
    const penaltiesApplied = countPassivityPenaltiesInEpisode({
      events: input.events,
      corner: passivityStart.cornerAtEvent,
      passivityStartedAt: passivityStart.createdAt,
    })
    const scoreState = reduceScoreEvents(
      input.events,
      passivityStart.period ?? 'main',
      input.attemptNumber,
    )
    const nextSanction = nextSanctionOnLadder(
      'PASSIVITY',
      scoreState.passivityLadder[passivityStart.cornerAtEvent],
    )
    snapshot.passivity = {
      startedAt: passivityStart.createdAt.toISOString(),
      startBoutElapsedMs,
      entryId: passivityStart.entryId,
      corner: passivityStart.cornerAtEvent,
      elapsedMs,
      penaltiesApplied,
      nextPenaltyInMs: msUntilNextPassivityPenalty(elapsedMs, penaltiesApplied),
      nextSanction,
      disqualificationDue: isPassivityDisqualificationDueFromElapsed({
        elapsedMs,
        penaltiesApplied,
        nextSanction,
      }),
    }
  }

  return snapshot
}
