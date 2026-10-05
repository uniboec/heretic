#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Switch Close-Control · Юноши 2 · до 41 кг to bronzeMode TWO so public podium
 * shows both semi-final losers on 3rd place instead of duplicating the finalist.
 */
import { prisma } from '../lib/prisma'
import { lockCompetitionDrawForCategory } from '../lib/bouts/lockCompetitionForBout'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { deserializePublishedStructure, serializePublishedStructure } from '../lib/brackets/core/snapshot'
import { structureWithDerivedResult } from '../lib/brackets/deriveCategoryPlacements'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

const CATEGORY_KEY = 'close_control:experienced:m_youths_2:m_youths_2_w_le_41'

const EXPECTED = {
  first: 'e6e292e6-7c48-4814-8ab7-9f8e61b88ad6',
  second: '99640cb8-ca34-41e2-91f2-ea6e139b205e',
  thirds: [
    '588332f6-f313-403a-a758-dcd188589a40',
    '132148e5-704e-428c-860b-b796a81a81db',
  ],
} as const

function placementKey(result: ReturnType<typeof readCategoryResult>) {
  return (result?.placements ?? [])
    .sort((a, b) => a.placement - b.placement || a.entryId.localeCompare(b.entryId))
    .map((row) => `${row.placement}:${row.entryId}`)
}

async function main() {
  const outcome = await prisma.$transaction(async (tx) => {
    const pair = await lockCompetitionDrawForCategory(tx, CATEGORY_KEY)
    const draw = pair.draw
    const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    if (systemId !== 'olympic' || draw.participants.length !== 4) {
      throw new Error(`Unexpected category shape: ${systemId}, n=${draw.participants.length}`)
    }

    const previousBronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
    const snapshot = deserializePublishedStructure(draw.publishedStructureJson)
    if (!snapshot) throw new Error('Missing published structure')

    const structure = structureWithDerivedResult(snapshot.structure, {
      systemId,
      bronzeMode: 'TWO',
      participantCount: draw.participants.length,
    })
    const derived = readCategoryResult(structure, systemId, {
      participantCount: draw.participants.length,
      bronzeMode: 'TWO',
    })

    const key = placementKey(derived)
    const expectedKey = new Set([
      `1:${EXPECTED.first}`,
      `2:${EXPECTED.second}`,
      `3:${EXPECTED.thirds[0]}`,
      `3:${EXPECTED.thirds[1]}`,
    ])
    if (key.length !== expectedKey.size || key.some((row) => !expectedKey.has(row))) {
      throw new Error(`Derived placements mismatch: ${key.join('|')}`)
    }

    if (previousBronzeMode === 'TWO' && draw.bronzeModeOverride === 'TWO') {
      return {
        ok: true,
        alreadyFixed: true,
        categoryKey: CATEGORY_KEY,
        title: getCategoryTitleFromKey(CATEGORY_KEY),
        bronzeMode: 'TWO',
        placements: derived?.placements ?? [],
      }
    }

    await tx.bracketCategoryDraw.update({
      where: { id: draw.id },
      data: {
        bronzeModeOverride: 'TWO',
        publishedStructureJson: serializePublishedStructure({
          systemId: snapshot.systemId,
          systemVersion: snapshot.systemVersion,
          structure,
        }),
      },
    })

    const name = (entryId: string) =>
      draw.participants.find((row) => row.entryId === entryId)?.snapshotDisplayName ?? entryId

    return {
      ok: true,
      alreadyFixed: false,
      categoryKey: CATEGORY_KEY,
      title: getCategoryTitleFromKey(CATEGORY_KEY),
      previousBronzeMode,
      bronzeMode: 'TWO',
      placements: (derived?.placements ?? []).map((placement) => ({
        placement: placement.placement,
        name: name(placement.entryId),
        reason: placement.reason,
      })),
    }
  })

  const draw = await prisma.bracketCategoryDraw.findFirst({
    where: { categoryKey: CATEGORY_KEY },
    include: { participants: { orderBy: { seedPosition: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
  })
  if (!draw) throw new Error('draw missing after update')

  const effectiveBronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
  const publicStructure = readPublishedStructure({
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
  const publicResult = readCategoryResult(
    publicStructure,
    getEffectiveSystemId(draw.autoSystemId, draw.systemOverride),
    {
      participantCount: draw.participants.length,
      bronzeMode: effectiveBronzeMode,
    },
  )

  console.log(
    JSON.stringify(
      {
        ...outcome,
        publicBronzeMode: effectiveBronzeMode,
        publicPlacements: (publicResult?.placements ?? []).map((placement) => ({
          placement: placement.placement,
          entryId: placement.entryId,
        })),
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
