#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Close-Control · Опытные · 6–7 · до 26 кг (three_way):
 * - bout-2: Пироженко победила (неявка Аниты), не наоборот
 * - bout-3: финал Цыкарева — Пироженко (убрать фиктивные победы Аниты)
 * - пьедестал: 1 Цыкарева, 2 Пироженко, 3 Анита
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

const CATEGORY_KEY = 'close_control:experienced:f_girls_2:f_girls_2_w_le_26'

const ENTRY = {
  tsikareva: 'f6d3dff3-e3d4-43ba-87e1-46eb0558d086',
  pirozhenko: 'aec2064e-deeb-4a07-867a-bc2937e2b0e1',
  anita: '18e2af53-c3f5-4620-b9cb-be4f1274ac28',
} as const

const BOUT = {
  semi: `${CATEGORY_KEY}::bout-1`,
  return: `${CATEGORY_KEY}::bout-2`,
  final: `${CATEGORY_KEY}::bout-3`,
} as const

const CORRECTED_RESULT: CategoryResult = {
  status: 'complete',
  placements: [
    { entryId: ENTRY.tsikareva, placement: 1, reason: 'FINAL_WINNER' },
    { entryId: ENTRY.pirozhenko, placement: 2, reason: 'FINAL_LOSER' },
    { entryId: ENTRY.anita, placement: 3, reason: 'THREE_WAY_BRONZE' },
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
        boutId: { in: [BOUT.semi, BOUT.return, BOUT.final] },
        isCurrent: true,
        resultStatus: 'ACTIVE',
      },
    })
    const byBout = new Map(currentResults.map((row) => [row.boutId, row]))
    for (const boutId of [BOUT.semi, BOUT.return, BOUT.final]) {
      if (!byBout.has(boutId)) throw new Error(`Missing bout result: ${boutId}`)
    }

    const semi = byBout.get(BOUT.semi)!
    if (semi.winnerEntryId !== ENTRY.tsikareva || semi.loserEntryId !== ENTRY.pirozhenko) {
      throw new Error('Unexpected bout-1 result; aborting')
    }

    const adminNote = {
      adminCorrection: true,
      correctedAt: new Date().toISOString(),
      note: 'Anita no-show: bout-2 to Pirozhenko; final Tsikareva vs Pirozhenko',
    }

    await tx.boutResult.update({
      where: { id: byBout.get(BOUT.return)!.id },
      data: {
        winnerEntryId: ENTRY.pirozhenko,
        loserEntryId: ENTRY.anita,
        victoryMethod: 'FORFEIT',
        decisionReason: 'FORFEIT',
        decisionDetails: adminNote,
      },
    })

    await tx.boutResult.update({
      where: { id: byBout.get(BOUT.final)!.id },
      data: {
        winnerEntryId: ENTRY.tsikareva,
        loserEntryId: ENTRY.pirozhenko,
        victoryMethod: 'FORFEIT',
        decisionReason: 'FORFEIT',
        decisionDetails: {
          ...adminNote,
          note: 'Final pairing corrected; removed phantom Anita wins',
        },
      },
    })

    const refreshedResults = await tx.boutResult.findMany({
      where: {
        boutId: { in: [BOUT.semi, BOUT.return, BOUT.final] },
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
          status: 'PENDING',
          needsReview: false,
          conflictReason: null,
          ceremonySequence: null,
          ceremonyCompletedAt: null,
          actualStartAt: null,
          actualEndAt: null,
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
      bouts: [
        { id: 'bout-1', winner: name(ENTRY.tsikareva), loser: name(ENTRY.pirozhenko), method: 'INJURY' },
        { id: 'bout-2', winner: name(ENTRY.pirozhenko), loser: name(ENTRY.anita), method: 'FORFEIT' },
        { id: 'bout-3', winner: name(ENTRY.tsikareva), loser: name(ENTRY.pirozhenko), method: 'FORFEIT' },
      ],
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
