#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'

import { prisma } from '../lib/prisma'
import { getActivePublishedGeneration, getPublicVisiblePublishedDraws } from '../lib/brackets/generation/publishedDraws'
import { deserializePublishedStructure } from '../lib/brackets/core/snapshot'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

async function main() {
  const published = await getActivePublishedGeneration(prisma)
  if (!published) throw new Error('no generation')
  const visiblePairs = await getPublicVisiblePublishedDraws(published)

  const rows = visiblePairs.map((pair) => {
    const snapshot = deserializePublishedStructure(pair.draw.publishedStructureJson)
    const result = snapshot?.structure?.result
    return {
      categoryKey: pair.draw.categoryKey,
      title: getCategoryTitleFromKey(pair.draw.categoryKey),
      status: result?.status ?? 'none',
      placements: result?.placements?.length ?? 0,
      placementNums: (result?.placements ?? []).map((p) => p.placement).sort((a, b) => a - b),
    }
  })

  const missingFromPublicLike = rows.filter((r) => r.placements === 0)
  const partial = rows.filter((r) => r.placements > 0 && r.placements < 2)

  console.log(
    JSON.stringify(
      {
        totalPlacements: rows.reduce((s, r) => s + r.placements, 0),
        zeroPlacementCategories: missingFromPublicLike,
        partial,
        all: rows,
      },
      null,
      2,
    ),
  )
}

main().finally(async () => prisma.$disconnect())
