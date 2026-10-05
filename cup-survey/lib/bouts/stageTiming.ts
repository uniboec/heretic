import { TOURNAMENT_TIMEZONE } from '../config/tournament'
import { toTournamentInstant } from '../datetime/tournament'
import { resolveStageNotBefore } from './competitionStageSettings'
import {
  collectScheduledUsedStages,
  previousUsedStage,
  stageGapMinutes,
} from './competitionStages'
import type { NormalizedBoutsPageSettings } from './normalizeBoutsPageSettings'
import type { ScheduledBout, StageTimingSummary } from './scheduleTypes'

const EPOCH = new Date(0)

function maxDate(dates: Date[]): Date {
  if (dates.length === 0) return EPOCH
  return new Date(Math.max(...dates.map((d) => d.getTime())))
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

function parseIso(iso: string): Date {
  return new Date(iso)
}

export type PlannedStageContext = {
  usedStages: number[]
  plannedEndAtByBout: Map<string, Date>
  boutStages: Map<string, number>
  pageSettings: NormalizedBoutsPageSettings
  eventDate: string
}

export function buildPlannedStageContext(input: {
  allBouts: { id: string; competitionStage: number }[]
  plannedEndAtByBout: Map<string, Date>
  pageSettings: NormalizedBoutsPageSettings
  eventDate: string
}): PlannedStageContext {
  return {
    usedStages: collectScheduledUsedStages(input.allBouts),
    plannedEndAtByBout: input.plannedEndAtByBout,
    boutStages: new Map(input.allBouts.map((b) => [b.id, b.competitionStage])),
    pageSettings: input.pageSettings,
    eventDate: input.eventDate,
  }
}

function maxPlannedEndOfStage(
  stage: number,
  plannedEndAtByBout: Map<string, Date>,
  boutStages: Map<string, number>,
): Date {
  const ends: Date[] = []
  for (const [id, endAt] of plannedEndAtByBout) {
    if (boutStages.get(id) === stage) ends.push(endAt)
  }
  return ends.length ? maxDate(ends) : EPOCH
}

export function resolveStagePlannedStart(stage: number, ctx: PlannedStageContext): Date {
  const prevStage = previousUsedStage(stage, ctx.usedStages)
  if (prevStage === null) {
    const tournamentStart = toTournamentInstant({
      eventDate: ctx.eventDate,
      localTime: ctx.pageSettings.boutsStartTime,
      timeZone: TOURNAMENT_TIMEZONE,
    })
    const notBefore = resolveStageNotBefore(
      stage,
      ctx.pageSettings.competitionStageSettings,
      ctx.eventDate,
      TOURNAMENT_TIMEZONE,
    )
    return maxDate([tournamentStart, notBefore])
  }

  const prevEnd = maxPlannedEndOfStage(prevStage, ctx.plannedEndAtByBout, ctx.boutStages)
  const afterPrev = addMinutes(
    prevEnd,
    stageGapMinutes(
      prevStage,
      ctx.pageSettings.competitionStageSettings,
      ctx.pageSettings.boutBreakMinutes,
    ),
  )
  const notBefore = resolveStageNotBefore(
    stage,
    ctx.pageSettings.competitionStageSettings,
    ctx.eventDate,
    TOURNAMENT_TIMEZONE,
  )
  return maxDate([afterPrev, notBefore])
}

export function resolveEstimatedStageStart(input: {
  stage: number
  allTimedBouts: ScheduledBout[]
  plannedCtx: PlannedStageContext
  pageSettings: NormalizedBoutsPageSettings
  eventDate: string
}): Date {
  const plannedStart = resolveStagePlannedStart(input.stage, input.plannedCtx)
  const usedStages = collectScheduledUsedStages(input.allTimedBouts)
  const prevStage = previousUsedStage(input.stage, usedStages)

  let liveBarrier: Date
  if (prevStage === null) {
    liveBarrier = resolveStageNotBefore(
      input.stage,
      input.pageSettings.competitionStageSettings,
      input.eventDate,
      TOURNAMENT_TIMEZONE,
    )
  } else {
    const prevEnds = input.allTimedBouts
      .filter((b) => b.competitionStage === prevStage)
      .map((b) => parseIso(b.timing.actualEndAt ?? b.timing.estimatedEndAt))
    const prevStageEnd = prevEnds.length ? maxDate(prevEnds) : EPOCH
    const afterPrev = addMinutes(
      prevStageEnd,
      stageGapMinutes(
        prevStage,
        input.pageSettings.competitionStageSettings,
        input.pageSettings.boutBreakMinutes,
      ),
    )
    const notBefore = resolveStageNotBefore(
      input.stage,
      input.pageSettings.competitionStageSettings,
      input.eventDate,
      TOURNAMENT_TIMEZONE,
    )
    liveBarrier = maxDate([afterPrev, notBefore])
  }

  return maxDate([plannedStart, liveBarrier])
}

export function applyStageFloorToAllMats(
  stage: number,
  floor: Date,
  bouts: ScheduledBout[],
): void {
  const floorMs = floor.getTime()
  for (const bout of bouts) {
    if (bout.competitionStage !== stage) continue
    if (bout.timing.status !== 'upcoming') continue
    const estimatedStart = parseIso(bout.timing.estimatedStartAt)
    if (estimatedStart.getTime() >= floorMs) continue
    bout.timing.estimatedStartAt = floor.toISOString()
    bout.timing.estimatedEndAt = addMinutes(floor, bout.timing.durationMinutes).toISOString()
    const scheduledStart = parseIso(bout.timing.scheduledStartAt)
    const delayMinutes = Math.max(
      0,
      Math.ceil((floor.getTime() - scheduledStart.getTime()) / 60_000),
    )
    bout.timing.delayMinutes = delayMinutes
    bout.timing.isDelayed = delayMinutes > 0
  }
}

export function rippleLaterBoutsOnAffectedMats(
  stage: number,
  bouts: ScheduledBout[],
  settings: NormalizedBoutsPageSettings,
): void {
  const byMat = new Map<number, ScheduledBout[]>()
  for (const bout of bouts) {
    const list = byMat.get(bout.matIndex) ?? []
    list.push(bout)
    byMat.set(bout.matIndex, list)
  }

  for (const matBouts of byMat.values()) {
    matBouts.sort(
      (a, b) =>
        parseIso(a.timing.estimatedStartAt).getTime() -
        parseIso(b.timing.estimatedStartAt).getTime(),
    )
    let cursor: Date | null = null
    for (const bout of matBouts) {
      if (bout.timing.status === 'completed' || bout.timing.status === 'in_progress') {
        const endIso = bout.timing.actualEndAt ?? bout.timing.estimatedEndAt
        cursor = addMinutes(parseIso(endIso), settings.boutBreakMinutes)
        continue
      }
      if (bout.timing.status !== 'upcoming') continue

      const estimatedStart = parseIso(bout.timing.estimatedStartAt)
      if (cursor && estimatedStart.getTime() < cursor.getTime()) {
        bout.timing.estimatedStartAt = cursor.toISOString()
        bout.timing.estimatedEndAt = addMinutes(
          cursor,
          bout.timing.durationMinutes,
        ).toISOString()
        const scheduledStart = parseIso(bout.timing.scheduledStartAt)
        const delayMinutes = Math.max(
          0,
          Math.ceil((cursor.getTime() - scheduledStart.getTime()) / 60_000),
        )
        bout.timing.delayMinutes = delayMinutes
        bout.timing.isDelayed = delayMinutes > 0
      }
      cursor = addMinutes(
        parseIso(bout.timing.estimatedEndAt),
        settings.boutBreakMinutes,
      )
    }
  }
}

export function buildStageTimingSummary(input: {
  usedStages: number[]
  allTimedBouts: ScheduledBout[]
  plannedCtx: PlannedStageContext
  pageSettings: NormalizedBoutsPageSettings
  eventDate: string
}): StageTimingSummary[] {
  return input.usedStages.map((stage) => {
    const prevStage = previousUsedStage(stage, input.usedStages)
    const plannedStartAt = resolveStagePlannedStart(stage, input.plannedCtx)
    const estimatedStartAt = resolveEstimatedStageStart({
      stage,
      allTimedBouts: input.allTimedBouts,
      plannedCtx: input.plannedCtx,
      pageSettings: input.pageSettings,
      eventDate: input.eventDate,
    })
    const notBefore = resolveStageNotBefore(
      stage,
      input.pageSettings.competitionStageSettings,
      input.eventDate,
      TOURNAMENT_TIMEZONE,
    )
    const delayMinutes = Math.max(
      0,
      Math.ceil((estimatedStartAt.getTime() - plannedStartAt.getTime()) / 60_000),
    )
    return {
      stage,
      notBeforeStartAt: notBefore.getTime() > 0 ? notBefore.toISOString() : undefined,
      plannedStartAt: plannedStartAt.toISOString(),
      estimatedStartAt: estimatedStartAt.toISOString(),
      delayMinutes,
      isDelayed: delayMinutes > 0,
      gapAfterPreviousMinutes:
        prevStage === null
          ? 0
          : stageGapMinutes(
              prevStage,
              input.pageSettings.competitionStageSettings,
              input.pageSettings.boutBreakMinutes,
            ),
    }
  })
}
