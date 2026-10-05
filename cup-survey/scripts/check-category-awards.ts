import { prisma } from '../lib/prisma'
import { deserializePublishedStructure } from '../lib/brackets/core/snapshot'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { extractBouts } from '../lib/bouts/extractBouts'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

const categoryKey = process.argv[2] ?? 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_52'

async function main() {
  const draw = await prisma.bracketCategoryDraw.findFirst({
    where: { categoryKey, status: 'ACTIVE' },
    include: { participants: true },
  })
  const queue = await prisma.awardCeremonyQueue.findUnique({
    where: {
      tournamentScopeId_categoryKey: {
        tournamentScopeId: 'cup-2026',
        categoryKey,
      },
    },
  })
  const results = await prisma.boutResult.findMany({
    where: {
      boutId: { startsWith: `${categoryKey}::` },
      isCurrent: true,
      resultStatus: 'ACTIVE',
    },
  })

  if (!draw) {
    console.log(JSON.stringify({ error: 'draw not found', categoryKey }, null, 2))
    return
  }

  const snapshot = deserializePublishedStructure(draw.publishedStructureJson)
  const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
  const result =
    snapshot && systemId ? readCategoryResult(snapshot.structure, systemId) : null
  const meta = {
    categoryKey,
    categoryTitle: getCategoryTitleFromKey(categoryKey),
    discipline: draw.discipline,
    storedMatIndex: draw.matIndex,
    competitionStage: draw.competitionStage,
  }
  const bouts = snapshot ? extractBouts(snapshot.structure, meta) : []

  console.log(
    JSON.stringify(
      {
        categoryKey,
        participantCount: draw.participants.length,
        boutCount: bouts.length,
        boutIds: bouts.map((bout) => bout.id),
        resolvedBoutIds: results.map((item) => item.boutId),
        resultStatus: result?.status ?? null,
        placementCount: result?.placements?.length ?? 0,
        inAwardsQueue: Boolean(queue),
        queueStatus: queue?.status ?? null,
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
