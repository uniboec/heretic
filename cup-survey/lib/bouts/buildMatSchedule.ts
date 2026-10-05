import { sortBoutsForSchedule } from './boutScheduleOrder'
import type { InternalBout } from './types'
import type { NormalizedBoutsPageSettings } from './normalizeBoutsPageSettings'
import type {
  ScheduleExecutionRecord,
  ScheduledBout,
  ScheduledBoutPlan,
  BoutTiming,
} from './scheduleTypes'
import { resolveBoutDurationMinutes } from './boutDuration'
import { resolveMatStartTime } from './startTimes'
import { toTournamentInstant } from '../datetime/tournament'
import { TOURNAMENT_TIMEZONE } from '../config/tournament'
import { getMatExecutionState } from './getMatExecutionState'
import {
  isBoutExecutionCompleted,
  isBoutExecutionInProgress,
} from './presentation/boutDisplayStatus'

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

function diffMinutes(later: Date, earlier: Date): number {
  return Math.max(0, Math.round((later.getTime() - earlier.getTime()) / 60_000))
}

function toIso(date: Date): string {
  return date.toISOString()
}

function buildTimingBase(input: {
  durationMinutes: number
  scheduledStartAt: Date
  scheduledEndAt: Date
  estimatedStartAt: Date
  estimatedEndAt: Date
  actualStartAt?: Date
  actualEndAt?: Date
  status: BoutTiming['status']
}): BoutTiming {
  const delayReference = input.actualStartAt ?? input.estimatedStartAt
  const delayMinutes = diffMinutes(delayReference, input.scheduledStartAt)

  return {
    durationMinutes: input.durationMinutes,
    scheduledStartAt: toIso(input.scheduledStartAt),
    scheduledEndAt: toIso(input.scheduledEndAt),
    estimatedStartAt: toIso(input.estimatedStartAt),
    estimatedEndAt: toIso(input.estimatedEndAt),
    ...(input.actualStartAt ? { actualStartAt: toIso(input.actualStartAt) } : {}),
    ...(input.actualEndAt ? { actualEndAt: toIso(input.actualEndAt) } : {}),
    status: input.status,
    delayMinutes,
    isDelayed: delayMinutes > 0,
  }
}

function mapBoutShell(bout: InternalBout, matIndex: number): Omit<ScheduledBout, 'timing'> {
  return {
    id: bout.id,
    matchNumber: bout.matchNumber,
    scheduleDisplayNumber: '',
    schedulePosition: 0,
    matId: null,
    matNumber: null,
    isFrozen: false,
    isInEditableZone: false,
    isNextStartable: false,
    matIndex,
    categoryKey: bout.categoryKey,
    categoryTitle: bout.categoryTitle,
    discipline: bout.discipline,
    competitionStage: bout.competitionStage,
    schedulePhase: bout.schedulePhase,
    ...(bout.label ? { label: bout.label } : {}),
    sideA: bout.sideA,
    sideB: bout.sideB,
  }
}

export function buildMatSchedule(input: {
  bouts: InternalBout[]
  matIndex: number
  settings: NormalizedBoutsPageSettings
  eventDate: string
  now: Date
  executions: Map<string, ScheduleExecutionRecord>
  failClosed?: boolean
  plans?: ScheduledBoutPlan[]
}): ScheduledBout[] {
  getMatExecutionState(input.bouts, input.executions, input.failClosed ?? false)

  const orderedBouts =
    input.plans?.map((plan) => plan.bout) ?? sortBoutsForSchedule(input.bouts)
  const planByBoutId = new Map(input.plans?.map((plan) => [plan.bout.id, plan]) ?? [])

  const matStartLocal = resolveMatStartTime(input.matIndex, input.settings)
  const matStartInstant = toTournamentInstant({
    eventDate: input.eventDate,
    localTime: matStartLocal,
    timeZone: TOURNAMENT_TIMEZONE,
  })

  let plannedCursor = matStartInstant
  let liveCursor = matStartInstant
  let firstUpcomingSeen = false

  return orderedBouts.map((bout) => {
    const durationMinutes = resolveBoutDurationMinutes({
      categoryKey: bout.categoryKey,
      overrides: input.settings.ageDivisionDurationOverrides,
    })
    const execution = input.executions.get(bout.id)
    const plan = planByBoutId.get(bout.id)
    const scheduledStartAt = plan?.plannedStartAt ?? plannedCursor
    const scheduledEndAt = plan?.plannedEndAt ?? addMinutes(plannedCursor, durationMinutes)
    plannedCursor = addMinutes(scheduledEndAt, input.settings.boutBreakMinutes)

    const shell = mapBoutShell(bout, input.matIndex)

    if (execution && isBoutExecutionCompleted(execution)) {
      const actualStartAt = execution.actualStartAt ?? input.now
      const actualEndAt = execution.actualEndAt ?? input.now
      liveCursor = addMinutes(actualEndAt, input.settings.boutBreakMinutes)
      return {
        ...shell,
        timing: buildTimingBase({
          durationMinutes,
          scheduledStartAt,
          scheduledEndAt,
          estimatedStartAt: actualStartAt,
          estimatedEndAt: actualEndAt,
          actualStartAt,
          actualEndAt,
          status: 'completed',
        }),
      }
    }

    if (execution && isBoutExecutionInProgress(execution)) {
      const actualStartAt = execution.actualStartAt ?? input.now
      const estimatedEndAt = new Date(
        Math.max(
          addMinutes(actualStartAt, durationMinutes).getTime(),
          input.now.getTime(),
        ),
      )
      liveCursor = addMinutes(estimatedEndAt, input.settings.boutBreakMinutes)
      return {
        ...shell,
        timing: buildTimingBase({
          durationMinutes,
          scheduledStartAt,
          scheduledEndAt,
          estimatedStartAt: actualStartAt,
          estimatedEndAt,
          actualStartAt,
          status: 'in_progress',
        }),
      }
    }

    const isFirstUpcoming = !firstUpcomingSeen
    firstUpcomingSeen = true

    const estimatedStartAt = isFirstUpcoming
      ? new Date(
          Math.max(liveCursor.getTime(), input.now.getTime(), scheduledStartAt.getTime()),
        )
      : new Date(Math.max(liveCursor.getTime(), scheduledStartAt.getTime()))

    const estimatedEndAt = addMinutes(estimatedStartAt, durationMinutes)
    liveCursor = addMinutes(estimatedEndAt, input.settings.boutBreakMinutes)

    return {
      ...shell,
      timing: buildTimingBase({
        durationMinutes,
        scheduledStartAt,
        scheduledEndAt,
        estimatedStartAt,
        estimatedEndAt,
        status: 'upcoming',
      }),
    }
  })
}

export function getMatEndTimes(bouts: ScheduledBout[]): {
  scheduledEndAt: string | null
  estimatedEndAt: string | null
} {
  const lastBout = bouts.at(-1)
  return {
    scheduledEndAt: lastBout?.timing.scheduledEndAt ?? null,
    estimatedEndAt: lastBout?.timing.estimatedEndAt ?? null,
  }
}
