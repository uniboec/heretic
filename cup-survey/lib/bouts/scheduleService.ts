import { Prisma, type BracketGeneration } from '@prisma/client'
import { tournamentInfo } from '../config/tournament'
import { prisma } from '../prisma'
import { getActivePublishedGeneration } from '../brackets/generation/publishedDraws'
import { applyBoutDisplayStatuses } from './applyBoutDisplayStatuses'
import { buildMatSchedule, getMatEndTimes } from './buildMatSchedule'
import {
  buildDistributedSchedulesWithFallback,
  collectPlannedEndAtByBout,
} from './distributedSchedule'
import { collectScheduledUsedStages } from './competitionStages'
import { toTournamentInstant } from '../datetime/tournament'
import { TOURNAMENT_TIMEZONE } from '../config/tournament'
import type { BoutScheduleOverrides } from './scheduleOverrides'
import {
  assertNoOrphanExecutions,
  collectScheduleBoutIds,
  normalizeScheduleExecution,
} from './executionGuards'
import { applyScheduleDisplayNumbers } from './applyScheduleDisplayNumbers'
import { normalizeBoutsPageSettings } from './normalizeBoutsPageSettings'
import { loadEntryToAthleteMapForBouts } from './athleteIdentity'
import { isAthleteParticipationSpacingEnabled } from './athleteParticipationSpacing'
import { mergeBoutScheduleWaves, pruneBoutScheduleWaves } from './boutScheduleWaves'
import { assignScheduleWavesFromPlans } from './scheduleWaves'
import { getGroupedBoutsForSchedule } from './schedulePipeline'
import type { EntryToAthleteMap } from './athleteIdentity'
import { resolveMatStartTime } from './startTimes'
import type { GroupedBoutsResult } from './types'
import type {
  PublicMatTiming,
  ScheduleExecutionRecord,
  ScheduledMatsResult,
  StageTimingSummary,
} from './scheduleTypes'
import { BoutsPageSettingMissingError, BoutsScheduleCorruptError } from './errors'
import {
  applyStageFloorToAllMats,
  buildPlannedStageContext,
  buildStageTimingSummary,
  resolveEstimatedStageStart,
  rippleLaterBoutsOnAffectedMats,
} from './stageTiming'

export type ScheduleSnapshot = {
  settings: ReturnType<typeof normalizeBoutsPageSettings>
  executions: ScheduleExecutionRecord[]
  scheduleOverrides: BoutScheduleOverrides
  entryToAthlete?: EntryToAthleteMap
}

export type FullScheduleSnapshot = ScheduleSnapshot & {
  grouped: GroupedBoutsResult
  published: BracketGeneration | null
}

export async function loadScheduleSnapshot(
  tx: Prisma.TransactionClient,
): Promise<ScheduleSnapshot> {
  const rawSettings = await tx.boutsPageSetting.findUnique({ where: { id: 'default' } })
  if (!rawSettings) {
    throw new BoutsPageSettingMissingError()
  }
  const executions = await tx.boutScheduleExecution.findMany()

  return {
    settings: normalizeBoutsPageSettings(rawSettings),
    executions: executions.map((row) =>
      normalizeScheduleExecution({
        boutId: row.boutId,
        actualStartAt: row.actualStartAt,
        actualEndAt: row.actualEndAt,
        boutPhase: row.boutPhase,
        clockStartedAt: row.clockStartedAt,
        officialStartedAt: row.officialStartedAt,
        frozenScheduleFormatted: row.frozenScheduleFormatted,
        frozenScheduleMatNumber: row.frozenScheduleMatNumber,
        frozenSchedulePosition: row.frozenSchedulePosition,
      }),
    ),
    scheduleOverrides: {},
  }
}

export async function loadFullScheduleSnapshot(
  tx: Prisma.TransactionClient,
  options: { adminPreview: boolean },
): Promise<FullScheduleSnapshot> {
  const base = await loadScheduleSnapshot(tx)
  const published = await getActivePublishedGeneration(tx)
  let grouped = published
    ? await getGroupedBoutsForSchedule(tx, base.settings.matCount, {
        adminPreview: options.adminPreview,
      })
    : { mats: [], warnings: [] }

  let scheduleOverrides = base.scheduleOverrides
  if (published && grouped.mats.length > 0) {
    const { buildScheduleOverridesFromPairs, finalizeGroupedWithScheduleOverrides } = await import(
      './schedulePipeline'
    )
    const pairs = await (await import('../brackets/generation/publishedDraws')).getCurrentPublishedDraws({
      db: tx,
      activeGeneration: published,
    })
    scheduleOverrides = buildScheduleOverridesFromPairs(pairs, grouped)
    const finalized = finalizeGroupedWithScheduleOverrides(
      grouped,
      scheduleOverrides,
      base.settings.matCount,
    )
    grouped = finalized.grouped
    scheduleOverrides = finalized.overrides
  }

  const allBouts = grouped.mats.flatMap((mat) => mat.bouts)
  const entryToAthlete =
    allBouts.length > 0 ? await loadEntryToAthleteMapForBouts(allBouts, tx) : new Map()

  return {
    ...base,
    grouped,
    published,
    scheduleOverrides,
    entryToAthlete,
  }
}

export async function readFullScheduleSnapshot(options: {
  adminPreview: boolean
}): Promise<FullScheduleSnapshot> {
  return prisma.$transaction(async (tx) => loadFullScheduleSnapshot(tx, options), {
    maxWait: 15_000,
    timeout: 30_000,
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  })
}

export async function readScheduleSnapshot(): Promise<ScheduleSnapshot> {
  return prisma.$transaction(async (tx) => loadScheduleSnapshot(tx), {
    maxWait: 15_000,
    timeout: 30_000,
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  })
}

function executionMap(executions: ScheduleExecutionRecord[]) {
  return new Map(executions.map((execution) => [execution.boutId, execution]))
}

function applyLiveStageCascade(input: {
  mats: PublicMatTiming[]
  allBouts: { id: string; competitionStage: number }[]
  plannedEndAtByBout: Map<string, Date>
  settings: ReturnType<typeof normalizeBoutsPageSettings>
  eventDate: string
}): StageTimingSummary[] {
  const allTimedBouts = input.mats.flatMap((mat) => mat.bouts)
  const usedStages = collectScheduledUsedStages(input.allBouts)
  if (usedStages.length <= 1) {
    const plannedCtx = buildPlannedStageContext({
      allBouts: input.allBouts,
      plannedEndAtByBout: input.plannedEndAtByBout,
      pageSettings: input.settings,
      eventDate: input.eventDate,
    })
    return buildStageTimingSummary({
      usedStages,
      allTimedBouts,
      plannedCtx,
      pageSettings: input.settings,
      eventDate: input.eventDate,
    })
  }

  const plannedCtx = buildPlannedStageContext({
    allBouts: input.allBouts,
    plannedEndAtByBout: input.plannedEndAtByBout,
    pageSettings: input.settings,
    eventDate: input.eventDate,
  })

  for (const stage of usedStages.slice(1)) {
    const estimatedStart = resolveEstimatedStageStart({
      stage,
      allTimedBouts,
      plannedCtx,
      pageSettings: input.settings,
      eventDate: input.eventDate,
    })
    applyStageFloorToAllMats(stage, estimatedStart, allTimedBouts)
    rippleLaterBoutsOnAffectedMats(stage, allTimedBouts, input.settings)
  }

  return buildStageTimingSummary({
    usedStages,
    allTimedBouts,
    plannedCtx,
    pageSettings: input.settings,
    eventDate: input.eventDate,
  })
}

export function buildScheduledMats(input: {
  grouped: GroupedBoutsResult
  snapshot: ScheduleSnapshot
  now: Date
  failClosed?: boolean
}): ScheduledMatsResult {
  const executionsById = executionMap(input.snapshot.executions)
  assertNoOrphanExecutions({
    scheduleBoutIds: collectScheduleBoutIds(input.grouped.mats),
    executions: input.snapshot.executions,
  })

  const allBouts = input.grouped.mats.flatMap((mat) => mat.bouts)
  const boutsByMat = new Map(input.grouped.mats.map((mat) => [mat.matIndex, mat.bouts]))
  const matStartTimes = new Map(
    input.grouped.mats.map((mat) => [
      mat.matIndex,
      toTournamentInstant({
        eventDate: tournamentInfo.eventDate,
        localTime: resolveMatStartTime(mat.matIndex, input.snapshot.settings),
        timeZone: TOURNAMENT_TIMEZONE,
      }),
    ]),
  )
  const distributedPlans = buildDistributedSchedulesWithFallback({
    boutsByMat,
    overrides: input.snapshot.scheduleOverrides ?? {},
    settings: input.snapshot.settings,
    matStartTimes,
    eventDate: tournamentInfo.eventDate,
    entryToAthlete: input.snapshot.entryToAthlete,
  })

  if (isAthleteParticipationSpacingEnabled(input.snapshot.settings.athleteParticipationSpacing)) {
    const assignedWaves = assignScheduleWavesFromPlans(distributedPlans)
    const validIds = new Set(allBouts.map((bout) => bout.id))
    input.snapshot.settings.boutScheduleWaves = pruneBoutScheduleWaves(
      mergeBoutScheduleWaves(input.snapshot.settings.boutScheduleWaves, assignedWaves),
      validIds,
    )
  }
  const plannedEndAtByBout = collectPlannedEndAtByBout(distributedPlans)

  const mats = input.grouped.mats.map((mat) => {
    const scheduledBouts = applyBoutDisplayStatuses(
      buildMatSchedule({
        bouts: mat.bouts,
        matIndex: mat.matIndex,
        settings: input.snapshot.settings,
        eventDate: tournamentInfo.eventDate,
        now: input.now,
        executions: executionsById,
        failClosed: input.failClosed ?? false,
        plans: distributedPlans.get(mat.matIndex),
      }),
      executionsById,
    )

    const endTimes = getMatEndTimes(scheduledBouts)

    return {
      matIndex: mat.matIndex,
      configuredStartTime: resolveMatStartTime(mat.matIndex, input.snapshot.settings),
      scheduledEndAt: endTimes.scheduledEndAt,
      estimatedEndAt: endTimes.estimatedEndAt,
      bouts: scheduledBouts,
    }
  })

  const stageSummaries = applyLiveStageCascade({
    mats,
    allBouts,
    plannedEndAtByBout,
    settings: input.snapshot.settings,
    eventDate: tournamentInfo.eventDate,
  })

  const matsWithDisplayNumbers = applyScheduleDisplayNumbers({
    mats,
    settings: input.snapshot.settings,
    executions: executionsById,
  })

  return { mats: matsWithDisplayNumbers, stageSummaries }
}

export function buildScheduledMatsResultOrThrow(input: {
  grouped: GroupedBoutsResult
  snapshot: ScheduleSnapshot
  now: Date
}): ScheduledMatsResult {
  try {
    return buildScheduledMats({ ...input, failClosed: true })
  } catch (error) {
    if (error instanceof BoutsScheduleCorruptError) {
      throw error
    }
    throw new BoutsScheduleCorruptError(
      error instanceof Error ? error.message : 'Unknown schedule corruption',
    )
  }
}

export function buildScheduledMatsOrThrow(input: {
  grouped: GroupedBoutsResult
  snapshot: ScheduleSnapshot
  now: Date
}): PublicMatTiming[] {
  return buildScheduledMatsResultOrThrow(input).mats
}
