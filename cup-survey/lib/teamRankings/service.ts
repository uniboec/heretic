import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '@/lib/brackets/core/formatRules'
import { readCategoryResult } from '@/lib/brackets/core/readCategoryResult'
import { readPublishedStructure } from '@/lib/brackets/core/readPublishedStructure'
import { collectCategoryBoutIds } from '@/lib/brackets/buildBoutOutcomes'
import { getActivePublishedGeneration, getPublicVisiblePublishedDraws } from '@/lib/brackets/generation/publishedDraws'
import { maybeLazyReconcileCategoryPublishedStructure } from '@/lib/brackets/lazyReconcilePublishedStructure'
import { getBracketPageSettings } from '@/lib/brackets/service'
import { listActiveBoutResultsForBoutIds } from '@/lib/bouts/boutResultQueries'
import { getCategoryTitleFromKey } from '@/lib/registration/categoryIdentity'
import { prisma } from '@/lib/prisma'
import { aggregateTeamRankings } from './aggregate'
import { listTeamRankingDisciplineOptions } from './discipline'
import { getTeamRankingSettings, toTeamRankingPointSettings } from './settings'
import type { TeamRankingCategorySource, TeamRankingDisciplineFilter, TeamRankingsResponse } from './types'

const LAZY_RECONCILE_TX_OPTIONS = { timeout: 60_000 } as const

export function filterBoutResultsForTournamentScope<
  T extends { tournamentScopeId: string },
>(results: T[], scopeId = TOURNAMENT_SCOPE_ID): T[] {
  return results.filter((result) => result.tournamentScopeId === scopeId)
}

async function loadTeamRankingCategorySources(): Promise<{
  publishedAt: string | null
  categories: TeamRankingCategorySource[]
} | null> {
  const published = await getActivePublishedGeneration()
  if (!published) {
    return null
  }

  const visiblePairs = await getPublicVisiblePublishedDraws(published)
  await prisma.$transaction(async (tx) => {
    for (const pair of visiblePairs) {
      await maybeLazyReconcileCategoryPublishedStructure(tx, pair.draw.categoryKey)
    }
  }, LAZY_RECONCILE_TX_OPTIONS)

  const refreshedPairs = await getPublicVisiblePublishedDraws(published)
  const visibleDraws = refreshedPairs.map((pair) => pair.draw)

  const allBoutIds = visibleDraws.flatMap((draw) => {
    const effectiveBronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
    const structure = readPublishedStructure({
      publishedStructureJson: draw.publishedStructureJson,
      autoSystemId: draw.autoSystemId,
      systemOverride: draw.systemOverride,
      systemVersion: draw.systemVersion,
      autoBronzeMode: draw.autoBronzeMode,
      bronzeModeOverride: draw.bronzeModeOverride,
      drawSeed: draw.drawSeed,
      participants: draw.participants,
      effectiveBronzeMode,
    })
    if (!structure) {
      return []
    }
    return collectCategoryBoutIds(structure, {
      categoryKey: draw.categoryKey,
      categoryTitle: getCategoryTitleFromKey(draw.categoryKey),
      discipline: draw.discipline,
      storedMatIndex: draw.matIndex,
      competitionStage: draw.competitionStage,
    })
  })

  const activeResults =
    allBoutIds.length > 0 ? await listActiveBoutResultsForBoutIds(prisma, allBoutIds) : []
  const scopedResults = filterBoutResultsForTournamentScope(activeResults)
  const resultsByBoutId = new Map(scopedResults.map((result) => [result.boutId, result]))

  const categories: TeamRankingCategorySource[] = visibleDraws.map((draw) => {
    const effectiveSystemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    const effectiveBronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)

    const structure = readPublishedStructure({
      publishedStructureJson: draw.publishedStructureJson,
      autoSystemId: draw.autoSystemId,
      systemOverride: draw.systemOverride,
      systemVersion: draw.systemVersion,
      autoBronzeMode: draw.autoBronzeMode,
      bronzeModeOverride: draw.bronzeModeOverride,
      drawSeed: draw.drawSeed,
      participants: draw.participants,
      effectiveBronzeMode,
    })

    const categoryMeta = {
      categoryKey: draw.categoryKey,
      categoryTitle: getCategoryTitleFromKey(draw.categoryKey),
      discipline: draw.discipline,
      storedMatIndex: draw.matIndex,
      competitionStage: draw.competitionStage,
    }

    const categoryBoutIds = structure ? collectCategoryBoutIds(structure, categoryMeta) : []
    const boutResults = categoryBoutIds
      .map((boutId) => resultsByBoutId.get(boutId))
      .filter((result): result is NonNullable<typeof result> => result != null)
      .map((result) => ({
        boutId: result.boutId,
        winnerEntryId: result.winnerEntryId,
        loserEntryId: result.loserEntryId,
        victoryMethod: result.victoryMethod,
      }))

    return {
      categoryKey: draw.categoryKey,
      discipline: draw.discipline,
      participants: draw.participants.map((participant) => ({
        entryId: participant.entryId,
        clubName: participant.snapshotClubName ?? '',
        city: participant.snapshotCity ?? '',
      })),
      result: readCategoryResult(structure, effectiveSystemId, {
        participantCount: draw.participants.length,
        bronzeMode: effectiveBronzeMode,
      }),
      boutResults,
    }
  })

  return {
    publishedAt: published.publishedAt?.toISOString() ?? null,
    categories,
  }
}

export async function getPublicTeamRankings(
  discipline: TeamRankingDisciplineFilter,
): Promise<TeamRankingsResponse | null> {
  const bracketSettings = await getBracketPageSettings()
  if (!bracketSettings.publicEnabled) {
    return null
  }

  const settings = await getTeamRankingSettings()
  const pointSettings = toTeamRankingPointSettings(settings)
  const disciplines = listTeamRankingDisciplineOptions()

  const loaded = await loadTeamRankingCategorySources()
  if (!loaded) {
    return {
      published: false,
      publishedAt: null,
      rankingStatus: 'in_progress',
      pointSettings,
      disciplines,
      activeDiscipline: discipline,
      rows: [],
    }
  }

  const aggregated = aggregateTeamRankings({
    categories: loaded.categories,
    discipline,
    settings,
  })

  return {
    published: true,
    publishedAt: loaded.publishedAt,
    rankingStatus: aggregated.rankingStatus,
    pointSettings,
    disciplines,
    activeDiscipline: discipline,
    rows: aggregated.rows,
  }
}
