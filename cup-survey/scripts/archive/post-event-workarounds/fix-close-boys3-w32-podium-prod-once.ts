#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Close-Control · Опытные · 8–9 · до 32 кг (three_way):
 * 1 Петухов, 2 Очур-Оол, 3 Куликов
 */
import { prisma } from '../lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'
import { lockCompetitionDrawForCategory } from '../lib/bouts/lockCompetitionForBout'
import { extractBouts } from '../lib/bouts/extractBouts'
import { sortBouts } from '../lib/bouts/sortBouts'
import { patchStructureWithBoutResult } from '../lib/brackets/applyResult/patchPublishedStructure'
import { BracketSystemRegistry } from '../lib/brackets/core/registry'
import '../lib/brackets/systems/index'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { deserializePublishedStructure, serializePublishedStructure } from '../lib/brackets/core/snapshot'
import type { CategoryResult } from '../lib/brackets/core/types'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

const CATEGORY_KEY = 'close_control:experienced:m_boys_3:m_boys_3_w_le_32'

const ENTRY = {
  kulikov: '09879359-106f-4804-a14d-a98cc3effe55',
  petukhov: '9f67719c-d380-497e-b10a-b522b6abed68',
  ochurOol: 'cafb5847-ad7f-4cf4-8d3b-f40e7c2a027c',
} as const

const BOUT = {
  bout1: `${CATEGORY_KEY}::bout-1`,
  bout2: `${CATEGORY_KEY}::bout-2`,
  bout3: `${CATEGORY_KEY}::bout-3`,
} as const

const CORRECTED_RESULT: CategoryResult = {
  status: 'complete',
  placements: [
    { entryId: ENTRY.petukhov, placement: 1, reason: 'FINAL_WINNER' },
    { entryId: ENTRY.ochurOol, placement: 2, reason: 'FINAL_LOSER' },
    { entryId: ENTRY.kulikov, placement: 3, reason: 'THREE_WAY_BRONZE' },
  ],
}

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
  return result.placements.map((placement, placementIndex) => {
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

async function main() {
  const outcome = await prisma.$transaction(async (tx) => {
    const pair = await lockCompetitionDrawForCategory(tx, CATEGORY_KEY)
    const draw = pair.draw
    const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)

    if (systemId !== 'three_way' || draw.participants.length !== 3) {
      throw new Error(`Unexpected category: ${systemId}, n=${draw.participants.length}`)
    }
    if (draw.systemVersion == null) throw new Error('Missing systemVersion')

    const snapshot = deserializePublishedStructure(draw.publishedStructureJson)
    if (!snapshot) throw new Error('Missing snapshot')

    const currentResults = await tx.boutResult.findMany({
      where: {
        boutId: { in: [BOUT.bout1, BOUT.bout2, BOUT.bout3] },
        isCurrent: true,
        resultStatus: 'ACTIVE',
      },
    })
    const byBout = new Map(currentResults.map((row) => [row.boutId, row]))
    for (const boutId of [BOUT.bout1, BOUT.bout2, BOUT.bout3]) {
      if (!byBout.has(boutId)) throw new Error(`Missing bout result: ${boutId}`)
    }

    const adminNote = {
      adminCorrection: true,
      correctedAt: new Date().toISOString(),
      note: 'Podium: 1 Petukhov, 2 Ochur-Ool, 3 Kulikov',
    }

    await tx.boutResult.update({
      where: { id: byBout.get(BOUT.bout1)!.id },
      data: {
        winnerEntryId: ENTRY.petukhov,
        loserEntryId: ENTRY.kulikov,
        decisionDetails: adminNote,
      },
    })

    await tx.boutResult.update({
      where: { id: byBout.get(BOUT.bout2)!.id },
      data: {
        winnerEntryId: ENTRY.ochurOol,
        loserEntryId: ENTRY.kulikov,
        decisionDetails: adminNote,
      },
    })

    await tx.boutResult.update({
      where: { id: byBout.get(BOUT.bout3)!.id },
      data: {
        winnerEntryId: ENTRY.petukhov,
        loserEntryId: ENTRY.ochurOol,
        decisionDetails: adminNote,
      },
    })

    const refreshedResults = await tx.boutResult.findMany({
      where: {
        boutId: { in: [BOUT.bout1, BOUT.bout2, BOUT.bout3] },
        isCurrent: true,
        resultStatus: 'ACTIVE',
      },
    })

    const system = BracketSystemRegistry.get(systemId, draw.systemVersion)
    let structure = system.build({
      participants: draw.participants.map((participant) => ({
        entryId: participant.entryId,
        displayName: participant.snapshotDisplayName ?? '',
        clubName: participant.snapshotClubName ?? '',
        city: participant.snapshotCity ?? '',
        clubIdentity: `${participant.snapshotClubName ?? ''}::${participant.snapshotCity ?? ''}`,
        publicNumber: participant.snapshotPublicNumber,
        seedPosition: participant.seedPosition,
        seedLocked: participant.seedLocked,
      })),
      drawSeed: draw.drawSeed,
      options: { bronzeMode },
    })

    const categoryMeta = {
      categoryKey: draw.categoryKey,
      categoryTitle: getCategoryTitleFromKey(draw.categoryKey),
      discipline: draw.discipline,
      storedMatIndex: draw.matIndex,
      competitionStage: draw.competitionStage,
    }
    const boutOrder = sortBouts(extractBouts(structure, categoryMeta)).map((bout) => bout.id)
    const refreshedByBout = new Map(refreshedResults.map((row) => [row.boutId, row]))

    for (const boutId of boutOrder) {
      const result = refreshedByBout.get(boutId)
      if (!result) continue
      structure = patchStructureWithBoutResult({
        structure,
        boutId,
        winnerEntryId: result.winnerEntryId,
        loserEntryId: result.loserEntryId,
        participants: draw.participants,
        systemId,
        bronzeMode,
        participantCount: draw.participants.length,
      }).structure
    }

    structure = { ...structure, result: CORRECTED_RESULT }

    await tx.bracketCategoryDraw.update({
      where: { id: draw.id },
      data: {
        publishedStructureJson: serializePublishedStructure({
          systemId: snapshot.systemId,
          systemVersion: snapshot.systemVersion,
          structure,
        }),
      },
    })

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
    if (queue) {
      const placementRows = buildPlacementRows(CORRECTED_RESULT, draw.participants)
      await tx.awardCeremonyPlacement.deleteMany({ where: { queueId: queue.id } })
      await tx.awardCeremonyQueue.update({
        where: { id: queue.id },
        data: {
          status: queue.status === 'COMPLETED' ? 'PENDING' : queue.status,
          needsReview: false,
          conflictReason: null,
          ceremonySequence: queue.status === 'COMPLETED' ? null : queue.ceremonySequence,
          ceremonyCompletedAt: queue.status === 'COMPLETED' ? null : queue.ceremonyCompletedAt,
          actualStartAt: queue.status === 'COMPLETED' ? null : queue.actualStartAt,
          actualEndAt: queue.status === 'COMPLETED' ? null : queue.actualEndAt,
          placements: { create: placementRows },
          revision: { increment: 1 },
        },
      })
      await tx.awardsPageSetting.update({
        where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
        data: { queueRevision: { increment: 1 } },
      })
      awardUpdated = true
    }

    const name = (entryId: string) =>
      draw.participants.find((row) => row.entryId === entryId)?.snapshotDisplayName ?? entryId

    return {
      ok: true,
      categoryKey: CATEGORY_KEY,
      title: getCategoryTitleFromKey(CATEGORY_KEY),
      awardUpdated,
      placements: CORRECTED_RESULT.placements.map((placement) => ({
        placement: placement.placement,
        name: name(placement.entryId),
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
