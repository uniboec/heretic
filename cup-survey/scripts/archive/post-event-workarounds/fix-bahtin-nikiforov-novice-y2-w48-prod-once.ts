#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Swap podium in Close-Control · Новички · 12–13 · до 48 кг:
 * 1 Nikiforov, 2 Bahtin (final winner Nikiforov).
 */
import { prisma } from '../lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'
import { lockCompetitionDrawForCategory } from '../lib/bouts/lockCompetitionForBout'
import { reconcileCategoryPublishedStructure } from '../lib/brackets/reconcilePublishedStructure'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import type { CategoryPlacement, CategoryResult } from '../lib/brackets/core/types'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

const CATEGORY_KEY = 'close_control:novice:m_youths_2:m_youths_2_w_le_48'
const BOUT_ID = `${CATEGORY_KEY}::bout-1`

const ENTRY = {
  nikiforov: 'f504a4f2-b4df-4307-bc73-d1d1eeb3f0dd',
  bahtin: '7ea2a17a-f069-4853-a3d3-ce953ab0bfa4',
} as const

function parseDisplayName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  return {
    lastName: parts[0] ?? '',
    firstName: parts[1] ?? '',
    middleName: parts.length > 2 ? parts.slice(2).join(' ') : null,
  }
}

function buildPlacementRows(
  result: CategoryResult,
  participants: Array<{ entryId: string; snapshotDisplayName: string | null; snapshotClubName: string | null }>,
) {
  const placements = [...result.placements].sort((a, b) => a.placement - b.placement)
  return placements.map((placement: CategoryPlacement, placementIndex) => {
    const participant = participants.find((row) => row.entryId === placement.entryId)
    const names = parseDisplayName(participant?.snapshotDisplayName ?? placement.entryId)
    return {
      entryId: placement.entryId,
      placement: placement.placement,
      placementIndex,
      lastName: names.lastName,
      firstName: names.firstName,
      middleName: names.middleName,
      clubName: participant?.snapshotClubName ?? '',
    }
  })
}

function nameByEntry(
  participants: Array<{ entryId: string; snapshotDisplayName: string | null }>,
  entryId: string,
) {
  return participants.find((row) => row.entryId === entryId)?.snapshotDisplayName ?? entryId
}

async function main() {
  const outcome = await prisma.$transaction(async (tx) => {
    const pair = await lockCompetitionDrawForCategory(tx, CATEGORY_KEY)
    const draw = pair.draw
    const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)

    if (systemId !== 'olympic' || draw.participants.length !== 2) {
      throw new Error(`Unexpected category shape: ${systemId}, n=${draw.participants.length}`)
    }

    const current = await tx.boutResult.findFirst({
      where: { boutId: BOUT_ID, isCurrent: true, resultStatus: 'ACTIVE' },
    })
    if (!current) throw new Error(`Missing bout result: ${BOUT_ID}`)

    const alreadyFixed =
      current.winnerEntryId === ENTRY.nikiforov && current.loserEntryId === ENTRY.bahtin

    if (!alreadyFixed) {
      if (current.winnerEntryId !== ENTRY.bahtin || current.loserEntryId !== ENTRY.nikiforov) {
        throw new Error(
          `Unexpected bout result: winner=${current.winnerEntryId}, loser=${current.loserEntryId}`,
        )
      }

      await tx.boutResult.update({
        where: { id: current.id },
        data: {
          winnerEntryId: ENTRY.nikiforov,
          loserEntryId: ENTRY.bahtin,
          decisionDetails: {
            adminCorrection: true,
            correctedAt: new Date().toISOString(),
            note: 'Prod fix: Nikiforov 1st, Bahtin 2nd',
          },
        },
      })

      await reconcileCategoryPublishedStructure(tx, CATEGORY_KEY)
    }

    const refreshedDraw = await tx.bracketCategoryDraw.findUnique({
      where: { id: draw.id },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })
    if (!refreshedDraw) throw new Error('draw missing after reconcile')

    const structure = readPublishedStructure({
      publishedStructureJson: refreshedDraw.publishedStructureJson,
      autoSystemId: refreshedDraw.autoSystemId,
      systemOverride: refreshedDraw.systemOverride,
      systemVersion: refreshedDraw.systemVersion,
      autoBronzeMode: refreshedDraw.autoBronzeMode,
      bronzeModeOverride: refreshedDraw.bronzeModeOverride,
      drawSeed: refreshedDraw.drawSeed,
      participants: refreshedDraw.participants,
      effectiveBronzeMode: bronzeMode,
    })
    const result = readCategoryResult(structure, systemId, {
      participantCount: refreshedDraw.participants.length,
      bronzeMode,
    })

    const expected = [`1:${ENTRY.nikiforov}`, `2:${ENTRY.bahtin}`]
    const actual = (result?.placements ?? [])
      .sort((a, b) => a.placement - b.placement)
      .map((row) => `${row.placement}:${row.entryId}`)
    if (actual.join('|') !== expected.join('|')) {
      throw new Error(`Placements mismatch after fix: ${actual.join('|')}`)
    }

    const queue = await tx.awardCeremonyQueue.findUnique({
      where: {
        tournamentScopeId_categoryKey: {
          tournamentScopeId: TOURNAMENT_SCOPE_ID,
          categoryKey: CATEGORY_KEY,
        },
      },
      include: { placements: true },
    })

    let awardUpdated = false
    if (queue && result) {
      const placementRows = buildPlacementRows(result, refreshedDraw.participants)
      await tx.awardCeremonyPlacement.deleteMany({ where: { queueId: queue.id } })
      await tx.awardCeremonyQueue.update({
        where: { id: queue.id },
        data: {
          needsReview: false,
          conflictReason: null,
          placements: { create: placementRows },
        },
      })
      await tx.awardsPageSetting.update({
        where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
        data: { queueRevision: { increment: 1 } },
      })
      awardUpdated = true
    }

    return {
      ok: true,
      alreadyFixed,
      categoryKey: CATEGORY_KEY,
      title: getCategoryTitleFromKey(CATEGORY_KEY),
      awardUpdated,
      placements: (result?.placements ?? []).map((placement) => ({
        placement: placement.placement,
        name: nameByEntry(refreshedDraw.participants, placement.entryId),
      })),
      finalWinner: nameByEntry(refreshedDraw.participants, ENTRY.nikiforov),
      finalLoser: nameByEntry(refreshedDraw.participants, ENTRY.bahtin),
    }
  })

  console.log(JSON.stringify(outcome, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
