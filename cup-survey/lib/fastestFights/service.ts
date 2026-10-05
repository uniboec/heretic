import { getEffectiveBronzeMode } from '@/lib/brackets/core/formatRules'
import { readPublishedStructure } from '@/lib/brackets/core/readPublishedStructure'
import { getActivePublishedGeneration, getPublicVisiblePublishedDraws } from '@/lib/brackets/generation/publishedDraws'
import { maybeLazyReconcileCategoryPublishedStructure } from '@/lib/brackets/lazyReconcilePublishedStructure'
import { getBracketPageSettings } from '@/lib/brackets/service'
import { listActiveBoutResultsForBoutIds } from '@/lib/bouts/boutResultQueries'
import { extractBouts } from '@/lib/bouts/extractBouts'
import { buildScheduledMatsResultOrThrow, readFullScheduleSnapshot } from '@/lib/bouts/scheduleService'
import { getCategoryTitleFromKey } from '@/lib/registration/categoryIdentity'
import { prisma } from '@/lib/prisma'
import { filterBoutResultsForTournamentScope } from '@/lib/teamRankings/service'
import type { SubmissionSubtype } from '@/lib/config/fseRules'
import { aggregateFastestFights } from './aggregate'
import type { FastestFightBoutMeta, FastestFightParticipant, FastestFightsResponse } from './types'

function readSubmissionSubtype(decisionDetails: unknown): SubmissionSubtype | undefined {
  if (!decisionDetails || typeof decisionDetails !== 'object') return undefined
  const subtype = (decisionDetails as { submissionSubtype?: string }).submissionSubtype
  if (subtype === 'ARM' || subtype === 'LEG' || subtype === 'OTHER') {
    return subtype
  }
  return undefined
}

const LAZY_RECONCILE_TX_OPTIONS = { timeout: 60_000 } as const

async function loadFastestFightSources(): Promise<{
  publishedAt: string | null
  results: Array<{
    boutId: string
    winnerEntryId: string | null
    victoryMethod: string
    submissionSubtype?: SubmissionSubtype
    boutElapsedMs: number | null
    resultConfirmedAt: Date
  }>
  participantsByEntryId: Map<string, FastestFightParticipant>
  boutMetaById: Map<string, FastestFightBoutMeta>
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

  const participantsByEntryId = new Map<string, FastestFightParticipant>()
  const boutMetaById = new Map<string, FastestFightBoutMeta>()
  const allBoutIds: string[] = []

  for (const draw of visibleDraws) {
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

    for (const participant of draw.participants) {
      participantsByEntryId.set(participant.entryId, {
        entryId: participant.entryId,
        displayName: participant.snapshotDisplayName ?? participant.entryId,
        clubName: participant.snapshotClubName ?? '',
        city: participant.snapshotCity ?? '',
      })
    }

    if (!structure) {
      continue
    }

    const categoryMeta = {
      categoryKey: draw.categoryKey,
      categoryTitle: getCategoryTitleFromKey(draw.categoryKey),
      discipline: draw.discipline,
      storedMatIndex: draw.matIndex,
      competitionStage: draw.competitionStage,
    }

    const bouts = extractBouts(structure, categoryMeta)
    for (const bout of bouts) {
      allBoutIds.push(bout.id)
      boutMetaById.set(bout.id, {
        boutId: bout.id,
        scheduleDisplayNumber: '',
        categoryTitle: bout.categoryTitle,
        discipline: bout.discipline,
      })
    }
  }

  const scheduleDisplayByBoutId = new Map<string, string>()
  try {
    const snapshot = await readFullScheduleSnapshot({ adminPreview: false })
    if (snapshot.published) {
      const scheduled = buildScheduledMatsResultOrThrow({
        grouped: snapshot.grouped,
        snapshot,
        now: new Date(),
      })
      for (const mat of scheduled.mats) {
        for (const bout of mat.bouts) {
          scheduleDisplayByBoutId.set(bout.id, bout.scheduleDisplayNumber)
        }
      }
    }
  } catch {
    // Fastest fights can still render without schedule numbers.
  }

  for (const [boutId, meta] of boutMetaById) {
    boutMetaById.set(boutId, {
      ...meta,
      scheduleDisplayNumber: scheduleDisplayByBoutId.get(boutId) ?? meta.scheduleDisplayNumber,
    })
  }

  const activeResults =
    allBoutIds.length > 0 ? await listActiveBoutResultsForBoutIds(prisma, allBoutIds) : []
  const scopedResults = filterBoutResultsForTournamentScope(activeResults)

  return {
    publishedAt: published.publishedAt?.toISOString() ?? null,
    results: scopedResults.map((result) => ({
      boutId: result.boutId,
      winnerEntryId: result.winnerEntryId,
      victoryMethod: result.victoryMethod,
      submissionSubtype: readSubmissionSubtype(result.decisionDetails),
      boutElapsedMs: result.boutElapsedMs,
      resultConfirmedAt: result.resultConfirmedAt,
    })),
    participantsByEntryId,
    boutMetaById,
  }
}

export async function getPublicFastestFights(): Promise<FastestFightsResponse | null> {
  const bracketSettings = await getBracketPageSettings()
  if (!bracketSettings.publicEnabled) {
    return null
  }

  const loaded = await loadFastestFightSources()
  if (!loaded) {
    return {
      published: false,
      publishedAt: null,
      rows: [],
      totalEligible: 0,
    }
  }

  const aggregated = aggregateFastestFights({
    results: loaded.results,
    participantsByEntryId: loaded.participantsByEntryId,
    boutMetaById: loaded.boutMetaById,
  })

  return {
    published: true,
    publishedAt: loaded.publishedAt,
    rows: aggregated.rows,
    totalEligible: aggregated.totalEligible,
  }
}
