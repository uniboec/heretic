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

  const missingFromPublic: Array<{
    categoryKey: string
    title: string
    auditPlacements: number
    publicPlacements: number
    auditStatus: string | null
    storedStatus: string | null
  }> = []

  let auditMedalists = 0
  let publicMedalists = 0

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

    const auditResult = readCategoryResult(structure, systemId, {
      participantCount: draw.participants.length,
      bronzeMode,
    })
    const publicResult = readCategoryResult(structure, systemId)

    const auditCount = auditResult?.placements?.length ?? 0
    const publicCount = publicResult?.placements?.length ?? 0
    auditMedalists += auditCount
    publicMedalists += publicCount

    if (auditCount !== publicCount) {
      missingFromPublic.push({
        categoryKey: draw.categoryKey,
        title: getCategoryTitleFromKey(draw.categoryKey),
        auditPlacements: auditCount,
        publicPlacements: publicCount,
        auditStatus: auditResult?.status ?? null,
        storedStatus: structure?.result?.status ?? null,
      })
    }
  }

  console.log(
    JSON.stringify(
      {
        auditMedalists,
        publicMedalists,
        gap: auditMedalists - publicMedalists,
        mismatchedCategories: missingFromPublic.length,
        missingFromPublic,
      },
      null,
      2,
    ),
  )
}

main().finally(async () => prisma.$disconnect())
