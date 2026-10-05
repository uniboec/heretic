import { getEffectiveBronzeMode, getEffectiveSystemId } from '@/lib/brackets/core/formatRules'
import { readCategoryResult } from '@/lib/brackets/core/readCategoryResult'
import { readPublishedStructure } from '@/lib/brackets/core/readPublishedStructure'
import { collectCategoryBoutIds } from '@/lib/brackets/buildBoutOutcomes'
import {
  getActivePublishedGeneration,
  getCurrentPublishedDraws,
} from '@/lib/brackets/generation/publishedDraws'
import { maybeLazyReconcileCategoryPublishedStructure } from '@/lib/brackets/lazyReconcilePublishedStructure'
import { listActiveBoutResultsForBoutIds } from '@/lib/bouts/boutResultQueries'
import { getCategoryTitleFromKey } from '@/lib/registration/categoryIdentity'
import { prisma } from '@/lib/prisma'
import { filterBoutResultsForTournamentScope } from '@/lib/teamRankings/service'
import type {
  AthleteRatingCategorySource,
  AthleteRatingEntryInfo,
} from './types'

const LAZY_RECONCILE_TX_OPTIONS = { timeout: 60_000 } as const

function formatAthleteName(input: {
  lastName: string
  firstName: string
  middleName: string | null
}): string {
  const parts = [input.lastName, input.firstName]
  if (input.middleName) parts.push(input.middleName)
  return parts.join(' ')
}

export async function loadAthleteRatingSources(): Promise<{
  categories: AthleteRatingCategorySource[]
  entryInfoByEntryId: Map<string, AthleteRatingEntryInfo>
} | null> {
  const published = await getActivePublishedGeneration()
  if (!published) {
    return null
  }

  const pairs = await getCurrentPublishedDraws({ activeGeneration: published })
  await prisma.$transaction(async (tx) => {
    for (const pair of pairs) {
      await maybeLazyReconcileCategoryPublishedStructure(tx, pair.draw.categoryKey)
    }
  }, LAZY_RECONCILE_TX_OPTIONS)

  const refreshedPairs = await getCurrentPublishedDraws({ activeGeneration: published })
  const draws = refreshedPairs.map((pair) => pair.draw)

  const allBoutIds = draws.flatMap((draw) => {
    const effectiveBronzeMode = getEffectiveBronzeMode(
      draw.autoBronzeMode,
      draw.bronzeModeOverride,
    )
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
  const scopedResults = filterBoutResultsForTournamentScope(activeResults)
  const resultsByBoutId = new Map(scopedResults.map((result) => [result.boutId, result]))

  const entryIds = new Set<string>()
  for (const draw of draws) {
    for (const participant of draw.participants) {
      entryIds.add(participant.entryId)
    }
  }

  const entries = entryIds.size
    ? await prisma.athleteEntry.findMany({
        where: { id: { in: [...entryIds] } },
        include: {
          athlete: {
            include: {
              registration: {
                select: { clubName: true, city: true },
              },
            },
          },
        },
      })
    : []

  const entryInfoByEntryId = new Map<string, AthleteRatingEntryInfo>()
  for (const entry of entries) {
    const snapshotParticipant = draws
      .flatMap((draw) => draw.participants)
      .find((participant) => participant.entryId === entry.id)

    entryInfoByEntryId.set(entry.id, {
      entryId: entry.id,
      athleteId: entry.athleteId,
      discipline: entry.discipline,
      ageDivisionId: entry.ageDivisionId,
      displayName:
        snapshotParticipant?.snapshotDisplayName ??
        formatAthleteName(entry.athlete),
      clubName:
        snapshotParticipant?.snapshotClubName ??
        entry.athlete.registration.clubName ??
        '',
      city:
        snapshotParticipant?.snapshotCity ??
        entry.athlete.registration.city ??
        '',
      birthDate: entry.athlete.birthDate.toISOString().slice(0, 10),
      gender: entry.athlete.gender,
    })
  }

  const categories: AthleteRatingCategorySource[] = draws.map((draw) => {
    const effectiveSystemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    const effectiveBronzeMode = getEffectiveBronzeMode(
      draw.autoBronzeMode,
      draw.bronzeModeOverride,
    )

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
        fightOfficiallyStarted: result.fightOfficiallyStarted,
      }))

    return {
      categoryKey: draw.categoryKey,
      discipline: draw.discipline,
      participants: draw.participants.map((participant) => ({
        entryId: participant.entryId,
        displayName: participant.snapshotDisplayName ?? participant.entryId,
      })),
      result: readCategoryResult(structure, effectiveSystemId, {
        participantCount: draw.participants.length,
        bronzeMode: effectiveBronzeMode,
      }),
      boutResults,
    }
  })

  return { categories, entryInfoByEntryId }
}
