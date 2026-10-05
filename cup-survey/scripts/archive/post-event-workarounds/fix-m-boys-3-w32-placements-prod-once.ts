#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Re-derive three_way placements for Close-Control · Опытные · 8–9 лет · до 32 кг.
 * Touches only this category draw; does not affect mat sessions or other bouts.
 */
import { prisma } from '../lib/prisma'
import { lockCompetitionDrawForCategory } from '../lib/bouts/lockCompetitionForBout'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { deserializePublishedStructure, serializePublishedStructure } from '../lib/brackets/core/snapshot'
import { structureWithDerivedResult } from '../lib/brackets/deriveCategoryPlacements'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

const CATEGORY_KEY = 'close_control:experienced:m_boys_3:m_boys_3_w_le_32'
const EXPECTED_BOUT_IDS = [
  `${CATEGORY_KEY}::bout-1`,
  `${CATEGORY_KEY}::bout-2`,
  `${CATEGORY_KEY}::bout-3`,
]

async function main() {
  const outcome = await prisma.$transaction(async (tx) => {
    const pair = await lockCompetitionDrawForCategory(tx, CATEGORY_KEY)
    const draw = pair.draw
    const effectiveSystemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)

    if (effectiveSystemId !== 'three_way') {
      throw new Error(`Unexpected system: ${effectiveSystemId ?? 'null'}`)
    }
    if (draw.participants.length !== 3) {
      throw new Error(`Unexpected participant count: ${draw.participants.length}`)
    }

    const snapshot = deserializePublishedStructure(draw.publishedStructureJson)
    if (!snapshot) {
      throw new Error('Published structure snapshot is missing')
    }

    const previousResult = readCategoryResult(snapshot.structure, effectiveSystemId, {
      participantCount: draw.participants.length,
      bronzeMode,
    })

    const boutResults = await tx.boutResult.findMany({
      where: {
        boutId: { in: EXPECTED_BOUT_IDS },
        isCurrent: true,
        resultStatus: 'ACTIVE',
      },
      select: {
        boutId: true,
        winnerEntryId: true,
        loserEntryId: true,
      },
    })
    if (boutResults.length !== EXPECTED_BOUT_IDS.length) {
      throw new Error(`Expected ${EXPECTED_BOUT_IDS.length} bout results, found ${boutResults.length}`)
    }

    const executions = await tx.boutScheduleExecution.findMany({
      where: { boutId: { in: EXPECTED_BOUT_IDS } },
      select: { boutId: true, boutPhase: true },
    })
    const unconfirmed = executions.filter((row) => row.boutPhase !== 'confirmed')
    if (unconfirmed.length > 0) {
      throw new Error(`Unconfirmed bouts remain: ${unconfirmed.map((row) => row.boutId).join(', ')}`)
    }

    const structure = structureWithDerivedResult(snapshot.structure, {
      systemId: effectiveSystemId,
      bronzeMode,
      participantCount: draw.participants.length,
    })
    const nextResult = structure.result
    if (!nextResult || nextResult.status !== 'complete' || nextResult.placements.length !== 3) {
      throw new Error(
        `Derived result is not complete: ${JSON.stringify(nextResult ?? null)}`,
      )
    }

    const serialized = serializePublishedStructure({
      systemId: snapshot.systemId,
      systemVersion: snapshot.systemVersion,
      structure,
    })

    await tx.bracketCategoryDraw.update({
      where: { id: draw.id },
      data: { publishedStructureJson: serialized },
    })

    return {
      categoryKey: CATEGORY_KEY,
      title: getCategoryTitleFromKey(CATEGORY_KEY),
      previousStatus: previousResult?.status ?? null,
      nextStatus: nextResult.status,
      nextResult,
      placements: nextResult.placements.map((placement) => {
        const participant = draw.participants.find((row) => row.entryId === placement.entryId)
        return {
          placement: placement.placement,
          entryId: placement.entryId,
          name: participant?.snapshotDisplayName ?? placement.entryId,
          reason: placement.reason,
        }
      }),
    }
  })

  console.log(JSON.stringify({ ok: true, ...outcome }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
