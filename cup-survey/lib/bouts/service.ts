import { listActiveBoutResultsForBoutIds } from './boutResultQueries'
import { toAdminBoutsDto, toPublicDto } from './toPublicDto'
import { loadPublicLiveBoutStates } from './publicLiveBoutState'
import { AdminBoutsDashboardSchema } from './schemas'
import { BoutsPageSettingMissingError } from './errors'
import { normalizeBoutsPageSettings } from './normalizeBoutsPageSettings'
import { buildScheduledMatsResultOrThrow, readFullScheduleSnapshot } from './scheduleService'
import { prisma } from '../prisma'

export async function getBoutsPageSettings() {
  const settings = await prisma.boutsPageSetting.findUnique({ where: { id: 'default' } })
  if (!settings) {
    throw new BoutsPageSettingMissingError()
  }
  return settings
}

export async function getNormalizedBoutsPageSettings() {
  const settings = await getBoutsPageSettings()
  return normalizeBoutsPageSettings(settings)
}

function mapSettingsDto(settings: ReturnType<typeof normalizeBoutsPageSettings>) {
  return {
    publicEnabled: settings.publicEnabled,
    matCount: settings.matCount,
    matsEnabled: settings.matsEnabled,
    scheduleVersion: settings.scheduleVersion,
    scheduleLegacyGap: settings.scheduleLegacyGap,
    autoMatAssignMode: settings.autoMatAssignMode,
    autoMatByCategoryEnabled: settings.autoMatByCategoryEnabled,
    boutsStartTime: settings.boutsStartTime,
    matStartTimeOverrides: settings.matStartTimeOverrides,
    boutBreakMinutes: settings.boutBreakMinutes,
    ageDivisionDurationOverrides: settings.ageDivisionDurationOverrides,
    pinAllFinalsToEnd: settings.pinAllFinalsToEnd,
    competitionStageSettings: settings.competitionStageSettings,
    athleteParticipationSpacing: settings.athleteParticipationSpacing,
  }
}

export async function getPublicBouts() {
  const settings = await getNormalizedBoutsPageSettings()
  if (!settings.publicEnabled) {
    return null
  }

  const snapshot = await readFullScheduleSnapshot({ adminPreview: false })

  const generatedAt = new Date()
  if (!snapshot.published) {
    return toPublicDto({
      published: false,
      publishedAt: null,
      generatedAt,
      mats: [],
      scheduleVersion: settings.scheduleVersion,
      matsEnabled: settings.matsEnabled,
      scheduleLegacyGap: settings.scheduleLegacyGap,
    })
  }

  const scheduled = buildScheduledMatsResultOrThrow({
    grouped: snapshot.grouped,
    snapshot,
    now: generatedAt,
  })

  const categoryKeyByBoutId = new Map<string, string>()
  for (const mat of scheduled.mats) {
    for (const bout of mat.bouts) {
      categoryKeyByBoutId.set(bout.id, bout.categoryKey)
    }
  }

  const allBoutIds = scheduled.mats.flatMap((mat) => mat.bouts.map((bout) => bout.id))
  const boutResults = await listActiveBoutResultsForBoutIds(prisma, allBoutIds)
  const winnerByBoutId = new Map(
    boutResults.map((result) => [result.boutId, result.winnerEntryId]),
  )

  const liveStates = await loadPublicLiveBoutStates({
    durationOverrides: snapshot.settings.ageDivisionDurationOverrides,
    categoryKeyByBoutId,
    now: generatedAt,
  })

  const matsWithLiveScores = scheduled.mats.map((mat) => ({
    ...mat,
    bouts: mat.bouts.map((bout) => {
      const live = liveStates.get(bout.id)
      const winnerEntryId = winnerByBoutId.get(bout.id) ?? null
      const withWinner = { ...bout, winnerEntryId }
      if (!live) return withWinner
      return {
        ...withWinner,
        timing: {
          ...bout.timing,
          status: bout.timing.status === 'completed' ? bout.timing.status : 'in_progress',
          displayStatus:
            bout.timing.displayStatus === 'completed' ? 'completed' : 'in_progress',
          liveScore: {
            red: live.score.red,
            blue: live.score.blue,
            periodRemainingMs: live.periodRemainingMs,
            boutPhase: live.boutPhase,
            currentPeriod: live.currentPeriod,
          },
        },
      }
    }),
  }))

  return toPublicDto({
    published: true,
    publishedAt: snapshot.published.publishedAt,
    generatedAt,
    mats: matsWithLiveScores,
    stageSummaries: scheduled.stageSummaries,
    scheduleVersion: snapshot.settings.scheduleVersion,
    matsEnabled: snapshot.settings.matsEnabled,
    scheduleLegacyGap: snapshot.settings.scheduleLegacyGap,
  })
}

export async function getAdminBoutsDashboard() {
  const snapshot = await readFullScheduleSnapshot({ adminPreview: true })
  const generatedAt = new Date()

  if (!snapshot.published) {
    return AdminBoutsDashboardSchema.parse({
      generatedAt: generatedAt.toISOString(),
      scheduleVersion: snapshot.settings.scheduleVersion,
      matsEnabled: snapshot.settings.matsEnabled,
      scheduleLegacyGap: snapshot.settings.scheduleLegacyGap,
      eventFinalized: snapshot.settings.eventFinalized,
      settings: mapSettingsDto(snapshot.settings),
      published: false,
      publishedAt: null,
      mats: [],
      stageSummaries: [],
      scheduleOverrides: {},
      groupingWarnings: [],
    })
  }

  const scheduled = buildScheduledMatsResultOrThrow({
    grouped: snapshot.grouped,
    snapshot,
    now: generatedAt,
  })

  return AdminBoutsDashboardSchema.parse(
    toAdminBoutsDto({
      generatedAt,
      scheduleVersion: snapshot.settings.scheduleVersion,
      matsEnabled: snapshot.settings.matsEnabled,
      scheduleLegacyGap: snapshot.settings.scheduleLegacyGap,
      eventFinalized: snapshot.settings.eventFinalized,
      settings: mapSettingsDto(snapshot.settings),
      published: true,
      publishedAt: snapshot.published.publishedAt,
      mats: scheduled.mats,
      stageSummaries: scheduled.stageSummaries,
      scheduleOverrides: snapshot.scheduleOverrides,
      groupingWarnings: snapshot.grouped.warnings,
    }),
  )
}
