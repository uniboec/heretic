#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { getActivePublishedGeneration } from '../lib/brackets/generation/publishedDraws'
import { deserializePublishedStructure } from '../lib/brackets/core/snapshot'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { deriveCategoryPlacements } from '../lib/brackets/deriveCategoryPlacements'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

async function main() {
  const generation = await getActivePublishedGeneration(prisma)
  if (!generation) throw new Error('No active published generation')

  const draws = await prisma.bracketCategoryDraw.findMany({
    where: {
      generationId: generation.id,
      status: 'ACTIVE',
      OR: [{ autoSystemId: 'three_way' }, { systemOverride: 'three_way' }],
    },
    include: {
      participants: true,
      publicationState: true,
    },
    orderBy: { categoryKey: 'asc' },
  })

  const awardQueues = await prisma.awardCeremonyQueue.findMany({
    where: {
      categoryKey: { in: draws.map((draw) => draw.categoryKey) },
    },
    include: { placements: true },
  })
  const awardByCategory = new Map(awardQueues.map((row) => [row.categoryKey, row]))

  const rows = []
  for (const draw of draws) {
    const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
    const snapshot = deserializePublishedStructure(draw.publishedStructureJson)
    const structure = snapshot?.structure ?? null

    const boutIds = (structure?.rounds ?? []).map((m) => `${draw.categoryKey}::${m.id}`)
    const results = await prisma.boutResult.findMany({
      where: { boutId: { in: boutIds }, isCurrent: true, resultStatus: 'ACTIVE' },
      select: { boutId: true },
    })
    const executions = await prisma.boutScheduleExecution.findMany({
      where: { boutId: { in: boutIds } },
      select: { boutId: true, boutPhase: true },
    })
    const confirmedCount = executions.filter((row) => row.boutPhase === 'confirmed').length

    const stored = structure?.result ?? null
    const read = structure && systemId
      ? readCategoryResult(structure, systemId, {
          participantCount: draw.participants.length,
          bronzeMode,
        })
      : null
    const derivedFresh =
      structure && systemId
        ? deriveCategoryPlacements(structure, {
            systemId,
            bronzeMode,
            participantCount: draw.participants.length,
          })
        : null

    const award = awardByCategory.get(draw.categoryKey)
    rows.push({
      categoryKey: draw.categoryKey,
      title: getCategoryTitleFromKey(draw.categoryKey),
      participantCount: draw.participants.length,
      visible: draw.publicationState?.visible ?? false,
      boutsReleased: draw.publicationState?.boutsReleased ?? false,
      boutCount: boutIds.length,
      confirmedBouts: confirmedCount,
      resultCount: results.length,
      allBoutsConfirmed: confirmedCount === boutIds.length && boutIds.length > 0,
      storedStatus: stored?.status ?? null,
      storedPlacementCount: stored?.placements?.length ?? 0,
      readStatus: read?.status ?? null,
      readPlacementCount: read?.placements?.length ?? 0,
      derivedFreshStatus: derivedFresh?.status ?? null,
      derivedFreshPlacementCount: derivedFresh?.placements?.length ?? 0,
      awardQueueStatus: award?.status ?? null,
      awardPlacementCount: award?.placements.length ?? 0,
    })
  }

  const summary = {
    totalThreeWay: rows.length,
    brokenRead: rows.filter((row) => row.allBoutsConfirmed && row.readPlacementCount < 3).length,
    brokenStored: rows.filter((row) => row.allBoutsConfirmed && row.storedPlacementCount < 3).length,
    fixedByFreshDerive: rows.filter(
      (row) => row.allBoutsConfirmed && row.readPlacementCount < 3 && row.derivedFreshPlacementCount === 3,
    ).length,
    missingAwards: rows.filter((row) => row.allBoutsConfirmed && !row.awardQueueStatus).length,
    completeAwards: rows.filter((row) => row.awardQueueStatus).length,
  }

  console.log(JSON.stringify({ summary, rows }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
