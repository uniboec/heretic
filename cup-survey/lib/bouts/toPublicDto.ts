import type { AutoMatAssignMode } from './autoMatMode'
import type { BoutScheduleOverrides } from './scheduleOverrides'
import type { PublicMatTiming, ScheduledBout, StageTimingSummary } from './scheduleTypes'
import { PublicBoutsResponseSchema, type PublicBoutsResponse } from './schemas'
import type { InternalBoutSide } from './types'

function mapSide(side: InternalBoutSide | ScheduledBout['sideA']) {
  const typed = side as InternalBoutSide
  if (typed.kind === 'athlete') {
    return {
      kind: 'athlete' as const,
      entryId: typed.entryId,
      displayName: typed.displayName,
      clubName: typed.clubName,
      city: typed.city,
      publicNumber: typed.publicNumber,
    }
  }
  if (typed.kind === 'hint') {
    return {
      kind: 'hint' as const,
      label: typed.label,
      ...(typed.source ? { source: typed.source } : {}),
    }
  }
  return { kind: 'bye' as const }
}

function mapPublicScheduledBout(bout: ScheduledBout) {
  return {
    id: bout.id,
    scheduleDisplayNumber: bout.scheduleDisplayNumber,
    schedulePosition: bout.schedulePosition,
    matId: bout.matId,
    matNumber: bout.matNumber,
    isFrozen: bout.isFrozen,
    matIndex: bout.matIndex,
    categoryKey: bout.categoryKey,
    categoryTitle: bout.categoryTitle,
    discipline: bout.discipline,
    competitionStage: bout.competitionStage,
    schedulePhase: bout.schedulePhase,
    ...(bout.label ? { label: bout.label } : {}),
    sideA: mapSide(bout.sideA as InternalBoutSide),
    sideB: mapSide(bout.sideB as InternalBoutSide),
    timing: bout.timing,
    ...(bout.winnerEntryId !== undefined ? { winnerEntryId: bout.winnerEntryId } : {}),
  }
}

function mapAdminScheduledBout(bout: ScheduledBout) {
  return {
    ...mapPublicScheduledBout(bout),
    matchNumber: bout.matchNumber,
    isInEditableZone: bout.isInEditableZone,
    isNextStartable: bout.isNextStartable,
  }
}

function mapPublicMats(mats: PublicMatTiming[]) {
  return mats.map((mat) => ({
    matIndex: mat.matIndex,
    configuredStartTime: mat.configuredStartTime,
    scheduledEndAt: mat.scheduledEndAt,
    estimatedEndAt: mat.estimatedEndAt,
    bouts: mat.bouts.map(mapPublicScheduledBout),
  }))
}

function mapAdminMats(mats: PublicMatTiming[]) {
  return mats.map((mat) => ({
    matIndex: mat.matIndex,
    configuredStartTime: mat.configuredStartTime,
    scheduledEndAt: mat.scheduledEndAt,
    estimatedEndAt: mat.estimatedEndAt,
    bouts: mat.bouts.map(mapAdminScheduledBout),
  }))
}

export function toPublicDto(input: {
  published: boolean
  publishedAt: Date | null
  generatedAt: Date
  mats: PublicMatTiming[]
  stageSummaries?: StageTimingSummary[]
  scheduleVersion: number
  matsEnabled: boolean
  scheduleLegacyGap: boolean
}): PublicBoutsResponse {
  const mappedMats = mapPublicMats(input.mats)
  const matCount = mappedMats.length

  const stageSummaries = input.stageSummaries ?? []
  const scheduleMeta = {
    scheduleVersion: input.scheduleVersion,
    matsEnabled: input.matsEnabled,
    scheduleLegacyGap: input.scheduleLegacyGap,
  }
  const dto =
    input.published && input.publishedAt
      ? {
          published: true as const,
          publishedAt: input.publishedAt.toISOString(),
          generatedAt: input.generatedAt.toISOString(),
          matCount,
          mats: mappedMats,
          stageSummaries,
          ...scheduleMeta,
        }
      : {
          published: false as const,
          publishedAt: null,
          generatedAt: input.generatedAt.toISOString(),
          matCount: 0,
          mats: [],
          stageSummaries: [],
          ...scheduleMeta,
        }

  return PublicBoutsResponseSchema.parse(dto)
}

export function toAdminBoutsDto(input: {
  generatedAt: Date
  scheduleVersion: number
  matsEnabled: boolean
  scheduleLegacyGap: boolean
  settings: {
    publicEnabled: boolean
    matCount: number
    matsEnabled: boolean
    scheduleVersion: number
    scheduleLegacyGap: boolean
    autoMatAssignMode: AutoMatAssignMode
    autoMatByCategoryEnabled: boolean
    boutsStartTime: string
    matStartTimeOverrides: Record<string, string>
    boutBreakMinutes: number
    ageDivisionDurationOverrides: Record<string, number>
    pinAllFinalsToEnd: boolean
    competitionStageSettings: import('./competitionStageSettings').CompetitionStageSettings
    athleteParticipationSpacing: import('./athleteParticipationSpacing').AthleteParticipationSpacing
  }
  published: boolean
  publishedAt: Date | null
  mats: PublicMatTiming[]
  stageSummaries: StageTimingSummary[]
  scheduleOverrides: BoutScheduleOverrides
  groupingWarnings: Array<{
    code: 'STORED_MAT_INDEX_OUT_OF_RANGE' | 'AUTO_ASSIGNMENT_MISSING'
    categoryKey: string
    boutId: string
    storedMatIndex: number
    matCount: number
  }>
}) {
  return {
    generatedAt: input.generatedAt.toISOString(),
    scheduleVersion: input.scheduleVersion,
    matsEnabled: input.matsEnabled,
    scheduleLegacyGap: input.scheduleLegacyGap,
    settings: input.settings,
    published: input.published,
    publishedAt: input.publishedAt?.toISOString() ?? null,
    mats: mapAdminMats(input.mats),
    stageSummaries: input.stageSummaries,
    scheduleOverrides: input.scheduleOverrides,
    groupingWarnings: input.groupingWarnings,
  }
}
