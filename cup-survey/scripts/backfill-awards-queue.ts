/**
 * One-time backfill: enqueue already-complete categories into AwardCeremonyQueue.
 * Needed for categories that finished before the awards migration was applied.
 */
import { prisma } from '../lib/prisma'
import '../lib/brackets/systems'
import { deserializePublishedStructure } from '../lib/brackets/core/snapshot'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { notifyAwardCeremonyOnStructureFreeze } from '../lib/awards/hooks'
import { ensureAwardsPageSettings } from '../lib/awards/settings'

async function main() {
  await ensureAwardsPageSettings()

  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { status: 'ACTIVE' },
    include: { participants: true },
    orderBy: { categoryKey: 'asc' },
  })

  let enqueued = 0
  let skipped = 0

  for (const draw of draws) {
    const snapshot = deserializePublishedStructure(draw.publishedStructureJson)
    const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    if (!snapshot || !systemId) {
      skipped += 1
      continue
    }

    const result = readCategoryResult(snapshot.structure, systemId)
    if (result?.status !== 'complete') {
      skipped += 1
      continue
    }

    const existing = await prisma.awardCeremonyQueue.findUnique({
      where: {
        tournamentScopeId_categoryKey: {
          tournamentScopeId: 'cup-2026',
          categoryKey: draw.categoryKey,
        },
      },
    })
    if (existing) {
      skipped += 1
      continue
    }

    await prisma.$transaction(async (tx) => {
      await notifyAwardCeremonyOnStructureFreeze({
        tx,
        categoryKey: draw.categoryKey,
        publishedStructureJson: draw.publishedStructureJson,
        participants: draw.participants,
        systemId,
      })
    })

    enqueued += 1
    console.log(`Enqueued: ${draw.categoryKey}`)
  }

  const queueCount = await prisma.awardCeremonyQueue.count()
  console.log(`Done. Enqueued ${enqueued}, skipped ${skipped}, queue size ${queueCount}.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
