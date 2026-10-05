#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { getActivePublishedGeneration } from '../lib/brackets/generation/publishedDraws'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

async function main() {
  const published = await getActivePublishedGeneration(prisma)
  if (!published) throw new Error('no generation')

  const [allDraws, publicationStates] = await Promise.all([
    prisma.bracketCategoryDraw.findMany({
      where: { generationId: published.id, status: 'ACTIVE' },
      include: { participants: true },
      orderBy: { categoryKey: 'asc' },
    }),
    prisma.bracketPublicationState.findMany({
      include: { publishedDraw: { select: { generationId: true } } },
    }),
  ])

  const pubByKey = new Map(
    publicationStates
      .filter((row) => row.publishedDraw.generationId === published.id)
      .map((row) => [row.categoryKey, row]),
  )
  const rows = []

  for (const draw of allDraws) {
    const pub = pubByKey.get(draw.categoryKey)
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

    rows.push({
      title: getCategoryTitleFromKey(draw.categoryKey),
      categoryKey: draw.categoryKey,
      participants: draw.participants.length,
      publicVisible: pub?.visible ?? false,
      boutsReleased: pub?.boutsReleased ?? false,
      status: result?.status ?? null,
      placements: result?.placements?.length ?? 0,
    })
  }

  const hidden = rows.filter((r) => !r.publicVisible)
  const hiddenIncomplete = hidden.filter((r) => r.status !== 'complete')

  console.log(
    JSON.stringify(
      {
        summary: {
          totalActiveDraws: rows.length,
          publicVisible: rows.filter((r) => r.publicVisible).length,
          hidden: hidden.length,
          hiddenIncomplete: hiddenIncomplete.length,
          visibleIncomplete: rows.filter((r) => r.publicVisible && r.status !== 'complete').length,
        },
        hidden,
        hiddenIncomplete,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
