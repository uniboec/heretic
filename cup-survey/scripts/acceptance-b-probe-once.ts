#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'

import { prisma } from '../lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'
import { getActivePublishedGeneration, getPublicVisiblePublishedDraws } from '../lib/brackets/generation/publishedDraws'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { deserializePublishedStructure } from '../lib/brackets/core/snapshot'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

const AWARDS_CATEGORY_KEY = 'close_control:novice:m_youths_2:m_youths_2_w_le_48'

async function main() {
  const published = await getActivePublishedGeneration(prisma)
  if (!published) throw new Error('no published generation')

  const visiblePairs = await getPublicVisiblePublishedDraws(published)
  const championIssues: Array<{
    categoryKey: string
    title: string
    storedStatus: string | null
    readStatus: string | null
  }> = []

  for (const pair of visiblePairs) {
    const draw = pair.draw
    const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
    const isChampion = systemId === 'champion' || draw.participants.length === 1
    if (!isChampion) continue

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
    const snapshot = deserializePublishedStructure(draw.publishedStructureJson)
    const storedStatus = snapshot?.structure.result?.status ?? null
    const readStatus = readCategoryResult(structure, systemId, {
      participantCount: draw.participants.length,
      bronzeMode,
    })?.status ?? null

    if (storedStatus !== 'complete' || readStatus !== 'complete') {
      championIssues.push({
        categoryKey: draw.categoryKey,
        title: getCategoryTitleFromKey(draw.categoryKey),
        storedStatus,
        readStatus,
      })
    }
  }

  const award = await prisma.awardCeremonyQueue.findUnique({
    where: {
      tournamentScopeId_categoryKey: {
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        categoryKey: AWARDS_CATEGORY_KEY,
      },
    },
    select: { status: true, categoryKey: true },
  })

  const ok =
    championIssues.length === 0 &&
    award?.status === 'COMPLETED'

  const report = {
    ok,
    championCategoriesChecked: visiblePairs.filter((pair) => {
      const systemId = getEffectiveSystemId(pair.draw.autoSystemId, pair.draw.systemOverride)
      return systemId === 'champion' || pair.draw.participants.length === 1
    }).length,
    championIssues,
    awardQueue: {
      categoryKey: AWARDS_CATEGORY_KEY,
      status: award?.status ?? null,
      expected: 'COMPLETED',
    },
  }

  console.log(JSON.stringify(report, null, 2))
  if (!ok) process.exit(1)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
