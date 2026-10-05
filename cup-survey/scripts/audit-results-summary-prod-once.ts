#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { getActivePublishedGeneration, getPublicVisiblePublishedDraws } from '../lib/brackets/generation/publishedDraws'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

async function main() {
  const published = await getActivePublishedGeneration(prisma)
  if (!published) throw new Error('no generation')

  const visiblePairs = await getPublicVisiblePublishedDraws(published)
  const rows = []

  for (const pair of visiblePairs) {
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

    const placements = result?.placements ?? []
    rows.push({
      title: getCategoryTitleFromKey(draw.categoryKey),
      categoryKey: draw.categoryKey,
      systemId,
      participants: draw.participants.length,
      status: result?.status ?? null,
      placements: placements.map((p) => p.placement).sort((a, b) => a - b),
      hasThird: placements.some((p) => p.placement === 3),
      inPublicResults: result?.status === 'complete' && placements.length > 0,
    })
  }

  const complete = rows.filter((r) => r.status === 'complete')
  const incomplete = rows.filter((r) => r.status !== 'complete')
  const withThird = rows.filter((r) => r.hasThird)
  const withoutThirdComplete = complete.filter((r) => !r.hasThird)
  const twoPersonFinals = withoutThirdComplete.filter((r) => r.participants === 2)
  const publicResultMedalists = complete.reduce((sum, r) => sum + r.placements.length, 0)

  console.log(
    JSON.stringify(
      {
        summary: {
          visibleCategories: rows.length,
          complete: complete.length,
          incomplete: incomplete.length,
          withThirdPlace: withThird.length,
          completeWithoutThird: withoutThirdComplete.length,
          twoParticipantFinals: twoPersonFinals.length,
          publicResultMedalists,
          publicResultCategories: complete.length,
        },
        incomplete,
        completeWithoutThird: withoutThirdComplete,
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
