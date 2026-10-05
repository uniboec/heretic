import { TOURNAMENT_TIMEZONE } from '../config/tournament'
import { resolveStageNotBefore } from './competitionStageSettings'
import {
  collectScheduledUsedStages,
  previousUsedStage,
  stageGapMinutes,
} from './competitionStages'
import { BoutNotReadyError } from './errors'
import type { NormalizedBoutsPageSettings } from './normalizeBoutsPageSettings'
import type { ScheduledBout } from './scheduleTypes'
import {
  buildPlannedStageContext,
  resolveStagePlannedStart,
  type PlannedStageContext,
} from './stageTiming'

function maxDate(dates: Date[]): Date {
  return new Date(Math.max(...dates.map((d) => d.getTime())))
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

function parseIso(iso: string): Date {
  return new Date(iso)
}

export function isBoutTerminalForStageBarrier(bout: ScheduledBout): boolean {
  return bout.timing.status === 'completed'
}

export function resolveTerminalEndAtForStageBarrier(bout: ScheduledBout): Date {
  return parseIso(bout.timing.actualEndAt!)
}

export function assertStageGateAllowsStart(input: {
  bout: ScheduledBout
  allBoutsOnAllMats: ScheduledBout[]
  plannedCtx: PlannedStageContext
  pageSettings: NormalizedBoutsPageSettings
  eventDate: string
  mutationNow: Date
}): void {
  const usedStages = collectScheduledUsedStages(input.allBoutsOnAllMats)
  const prevStage = previousUsedStage(input.bout.competitionStage, usedStages)
  const plannedStartAt = resolveStagePlannedStart(input.bout.competitionStage, input.plannedCtx)

  if (prevStage === null) {
    if (input.mutationNow.getTime() < plannedStartAt.getTime()) {
      throw new BoutNotReadyError('Этап ещё не может начаться')
    }
    return
  }

  const prevBouts = input.allBoutsOnAllMats.filter((b) => b.competitionStage === prevStage)
  if (!prevBouts.every(isBoutTerminalForStageBarrier)) {
    throw new BoutNotReadyError('Предыдущий этап ещё не завершён')
  }

  const prevEnd = maxDate(prevBouts.map(resolveTerminalEndAtForStageBarrier))
  const afterBreak = addMinutes(
    prevEnd,
    stageGapMinutes(
      prevStage,
      input.pageSettings.competitionStageSettings,
      input.pageSettings.boutBreakMinutes,
    ),
  )
  const notBefore = resolveStageNotBefore(
    input.bout.competitionStage,
    input.pageSettings.competitionStageSettings,
    input.eventDate,
    TOURNAMENT_TIMEZONE,
  )
  const earliest = maxDate([plannedStartAt, afterBreak, notBefore])

  if (input.mutationNow.getTime() < earliest.getTime()) {
    throw new BoutNotReadyError('Этап ещё не может начаться')
  }
}

export function buildStageGatePlannedContext(input: {
  allBouts: ScheduledBout[]
  pageSettings: NormalizedBoutsPageSettings
  eventDate: string
}): PlannedStageContext {
  const plannedEndAtByBout = new Map<string, Date>()
  for (const bout of input.allBouts) {
    plannedEndAtByBout.set(bout.id, parseIso(bout.timing.scheduledEndAt))
  }
  return buildPlannedStageContext({
    allBouts: input.allBouts,
    plannedEndAtByBout,
    pageSettings: input.pageSettings,
    eventDate: input.eventDate,
  })
}
