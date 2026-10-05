import { prisma } from '../lib/prisma'
import { deserializePublishedStructure } from '../lib/brackets/core/snapshot'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { getEffectiveSystemId } from '../lib/brackets/core/formatRules'

async function main() {
  const settings = await prisma.awardsPageSetting.findUnique({
    where: { tournamentScopeId: 'cup-2026' },
  })
  const queue = await prisma.awardCeremonyQueue.findMany({
    select: { categoryKey: true, status: true },
    orderBy: { categoryKey: 'asc' },
  })

  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { status: 'ACTIVE' },
    select: {
      categoryKey: true,
      publishedStructureJson: true,
      autoSystemId: true,
      systemOverride: true,
    },
    orderBy: { categoryKey: 'asc' },
  })

  const completeCategories: string[] = []
  for (const draw of draws) {
    const snapshot = deserializePublishedStructure(draw.publishedStructureJson)
    const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    if (!snapshot || !systemId) continue
    const result = readCategoryResult(snapshot.structure, systemId)
    if (result?.status === 'complete') {
      completeCategories.push(draw.categoryKey)
    }
  }

  const queuedKeys = new Set(queue.map((item) => item.categoryKey))
  const missingInAwards = completeCategories.filter((key) => !queuedKeys.has(key))

  console.log(
    JSON.stringify(
      {
        publicEnabled: settings?.publicEnabled ?? false,
        queueCount: queue.length,
        queue,
        completeCategoryCount: completeCategories.length,
        completeCategories,
        missingInAwards,
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
