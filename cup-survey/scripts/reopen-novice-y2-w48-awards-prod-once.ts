#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Reopen Close-Control · Новички · 12–13 · до 48 кг in awards schedule:
 * status PENDING, correct placements Nikiforov 1 / Bahtin 2.
 */
import { prisma } from '../lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'
import { lockCompetitionDrawForCategory } from '../lib/bouts/lockCompetitionForBout'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import type { CategoryPlacement, CategoryResult } from '../lib/brackets/core/types'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

const CATEGORY_KEY = 'close_control:novice:m_youths_2:m_youths_2_w_le_48'

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
      status: 'PENDING' as const,
      resolvedAt: null,
    }
  })
}

async function main() {
  const outcome = await prisma.$transaction(async (tx) => {
    const pair = await lockCompetitionDrawForCategory(tx, CATEGORY_KEY)
    const draw = pair.draw
    const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)

    const structure = readPublishedStructure({
      publishedStructureJson: draw.publishedStructureJson,
      autoSystemId: draw.autoSystemId,
      systemOverride: draw.systemOverride,
      systemVersion: draw.systemVersion,
      autoBronzeMode: draw.autoBronzeMode,
      bronzeModeOverride: draw.bronzeModeOverride,
      drawSeed: draw.drawSeed,
      participants: draw.participants,
      effectiveBronzeMode: bronzeMode,
    })
    const result = readCategoryResult(structure, systemId, {
      participantCount: draw.participants.length,
      bronzeMode,
    })

    const expected = [`1:${ENTRY.nikiforov}`, `2:${ENTRY.bahtin}`]
    const actual = (result?.placements ?? [])
      .sort((a, b) => a.placement - b.placement)
      .map((row) => `${row.placement}:${row.entryId}`)
    if (result?.status !== 'complete' || actual.join('|') !== expected.join('|')) {
      throw new Error(`Bracket placements not ready: ${actual.join('|')}`)
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
    if (!queue) {
      throw new Error('Award queue missing; use enqueue script instead')
    }

    const maxOrder = await tx.awardCeremonyQueue.findFirst({
      where: {
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        queueGroup: 'NORMAL',
        status: { in: ['PENDING', 'SUSPENDED', 'IN_PROGRESS'] },
        id: { not: queue.id },
      },
      orderBy: { queueOrder: 'desc' },
      select: { queueOrder: true },
    })

    const placementRows = buildPlacementRows(result, draw.participants)
    await tx.awardCeremonyPlacement.deleteMany({ where: { queueId: queue.id } })

    const previousStatus = queue.status
    await tx.awardCeremonyQueue.update({
      where: { id: queue.id },
      data: {
        status: 'PENDING',
        queueGroup: 'NORMAL',
        queueOrder: (maxOrder?.queueOrder ?? -1) + 1,
        needsReview: false,
        conflictReason: null,
        ceremonySequence: null,
        ceremonyCompletedAt: null,
        actualStartAt: null,
        actualEndAt: null,
        completedAtCategory: new Date(),
        placements: { create: placementRows },
        revision: { increment: 1 },
      },
    })

    await tx.awardsPageSetting.update({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
      data: { queueRevision: { increment: 1 } },
    })

    const name = (entryId: string) =>
      draw.participants.find((row) => row.entryId === entryId)?.snapshotDisplayName ?? entryId

    return {
      ok: true,
      categoryKey: CATEGORY_KEY,
      title: getCategoryTitleFromKey(CATEGORY_KEY),
      previousStatus,
      newStatus: 'PENDING',
      queueOrder: (maxOrder?.queueOrder ?? -1) + 1,
      placements: placementRows.map((row) => ({
        placement: row.placement,
        name: name(row.entryId),
      })),
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
