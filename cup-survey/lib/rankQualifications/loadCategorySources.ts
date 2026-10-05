import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '@/lib/brackets/core/formatRules'
import { readCategoryResult } from '@/lib/brackets/core/readCategoryResult'
import { readPublishedStructure } from '@/lib/brackets/core/readPublishedStructure'
import { collectCategoryBoutIds } from '@/lib/brackets/buildBoutOutcomes'
import { getActivePublishedGeneration, getPublicVisiblePublishedDraws } from '@/lib/brackets/generation/publishedDraws'
import { maybeLazyReconcileCategoryPublishedStructure } from '@/lib/brackets/lazyReconcilePublishedStructure'
import { getCategoryTitleFromKey } from '@/lib/registration/categoryIdentity'
import { prisma } from '@/lib/prisma'
import { listActiveBoutResultsForBoutIds } from '@/lib/bouts/boutResultQueries'
import { filterBoutResultsForTournamentScope } from '@/lib/teamRankings/service'
import type { NormQualificationCategorySource } from './types'

const LAZY_RECONCILE_TX_OPTIONS = { timeout: 60_000 } as const

export async function loadNormQualificationCategorySources(): Promise<{
  publishedAt: string | null
  categories: NormQualificationCategorySource[]
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
    if (!structure) return []
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
  const scopedResults = filterBoutResultsForTournamentScope(activeResults, TOURNAMENT_SCOPE_ID)
  const resultsByBoutId = new Map(scopedResults.map((result) => [result.boutId, result]))

  const entryIds = [...new Set(visibleDraws.flatMap((draw) => draw.participants.map((p) => p.entryId)))]
  const entries =
    entryIds.length > 0
      ? await prisma.athleteEntry.findMany({
          where: { id: { in: entryIds } },
          select: {
            id: true,
            athleteId: true,
            athlete: {
              select: {
                birthDate: true,
                gender: true,
              },
            },
          },
        })
      : []
  const entryMeta = new Map(
    entries.map((entry) => [
      entry.id,
      {
        athleteId: entry.athleteId,
        birthDate: entry.athlete.birthDate.toISOString().slice(0, 10),
        gender: entry.athlete.gender,
      },
    ]),
  )

  const categories: NormQualificationCategorySource[] = visibleDraws.map((draw) => {
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
      participants: draw.participants
        .map((participant) => {
          const meta = entryMeta.get(participant.entryId)
          if (!meta) return null
          return {
            entryId: participant.entryId,
            athleteId: meta.athleteId,
            displayName: participant.snapshotDisplayName,
            birthDate: meta.birthDate,
            gender: meta.gender,
          }
        })
        .filter((participant): participant is NonNullable<typeof participant> => participant != null),
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
