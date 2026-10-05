#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Correct podium for Close-Control · Опытные · Юноши 2 · до 41 кг:
 * 1 Россошных, 2 Никифоров, 3 Сухорослов + Панов.
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

const CATEGORY_KEY = 'close_control:experienced:m_youths_2:m_youths_2_w_le_41'

const ENTRY = {
  panov: '132148e5-704e-428c-860b-b796a81a81db',
  sukhoroslov: '588332f6-f313-403a-a758-dcd188589a40',
  nikiforov: '99640cb8-ca34-41e2-91f2-ea6e139b205e',
  rossoshnykh: 'e6e292e6-7c48-4814-8ab7-9f8e61b88ad6',
} as const

const BOUT = {
  semi1: `${CATEGORY_KEY}::bout-1`,
  semi2: `${CATEGORY_KEY}::bout-2`,
  final: `${CATEGORY_KEY}::bout-3`,
  bronze: `${CATEGORY_KEY}::bronze-fight`,
} as const

const CORRECTED_RESULT: CategoryResult = {
  status: 'complete',
  placements: [
    { entryId: ENTRY.rossoshnykh, placement: 1, reason: 'FINAL_WINNER' },
    { entryId: ENTRY.nikiforov, placement: 2, reason: 'FINAL_LOSER' },
    { entryId: ENTRY.sukhoroslov, placement: 3, reason: 'BRONZE_TWO' },
    { entryId: ENTRY.panov, placement: 3, reason: 'BRONZE_TWO' },
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

    if (systemId !== 'olympic' || draw.participants.length !== 4) {
      throw new Error(`Unexpected category shape: ${systemId}, n=${draw.participants.length}`)
    }
    if (draw.systemVersion == null) {
      throw new Error('Missing systemVersion')
    }

    const snapshot = deserializePublishedStructure(draw.publishedStructureJson)
    if (!snapshot) throw new Error('Missing published structure')

    const currentResults = await tx.boutResult.findMany({
      where: {
        boutId: { in: [BOUT.semi1, BOUT.semi2, BOUT.final, BOUT.bronze] },
        isCurrent: true,
        resultStatus: 'ACTIVE',
      },
    })
    const byBout = new Map(currentResults.map((row) => [row.boutId, row]))

    for (const boutId of [BOUT.semi1, BOUT.semi2, BOUT.final, BOUT.bronze]) {
      if (!byBout.has(boutId)) {
        throw new Error(`Missing bout result: ${boutId}`)
      }
    }

    const semi1 = byBout.get(BOUT.semi1)!
    if (semi1.winnerEntryId !== ENTRY.rossoshnykh || semi1.loserEntryId !== ENTRY.panov) {
      throw new Error('Unexpected semi-1 result; aborting')
    }

    await tx.boutResult.update({
      where: { id: byBout.get(BOUT.semi2)!.id },
      data: {
        winnerEntryId: ENTRY.nikiforov,
        loserEntryId: ENTRY.sukhoroslov,
        decisionDetails: {
          adminCorrection: true,
          correctedAt: new Date().toISOString(),
          note: 'Semi-2 winner corrected to Nikiforov',
        },
      },
    })

    await tx.boutResult.update({
      where: { id: byBout.get(BOUT.final)!.id },
      data: {
        winnerEntryId: ENTRY.rossoshnykh,
        loserEntryId: ENTRY.nikiforov,
        decisionDetails: {
          adminCorrection: true,
          correctedAt: new Date().toISOString(),
          note: 'Final pairing corrected to Rossoshnykh vs Nikiforov',
        },
      },
    })

    const refreshedResults = await tx.boutResult.findMany({
      where: {
        boutId: { in: [BOUT.semi1, BOUT.semi2, BOUT.final, BOUT.bronze] },
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
          needsReview: false,
          conflictReason: null,
          placements: {
            create: placementRows,
          },
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
        reason: placement.reason,
      })),
      finalRound: structure.rounds.find((match) => match.id === 'bout-3'),
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
