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

  const byStatus: Record<string, number> = {}
  const stuckInProgress: Array<{
    categoryKey: string
    title: string
    placementCount: number
  }> = []

  for (const pair of visiblePairs) {
    const snapshot = deserializePublishedStructure(pair.draw.publishedStructureJson)
    const status = snapshot?.structure?.result?.status ?? 'none'
    const placementCount = snapshot?.structure?.result?.placements?.length ?? 0
    byStatus[status] = (byStatus[status] ?? 0) + 1

    if (status === 'in_progress' && placementCount === 0) {
      stuckInProgress.push({
        categoryKey: pair.draw.categoryKey,
        title: getCategoryTitleFromKey(pair.draw.categoryKey),
        placementCount,
      })
    }
  }

  console.log(
    JSON.stringify(
      {
        byStatus,
        stuckInProgressEmpty: stuckInProgress,
        totalVisible: visiblePairs.length,
      },
      null,
      2,
    ),
  )
}

main().finally(async () => prisma.$disconnect())
