import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { previewConsolidation, applyConsolidation } from '../lib/brackets/consolidation/apply'
import { computeDiffForDraft } from '../lib/brackets/dashboardDiff'
import { buildCategoriesCanonicalDto } from '../lib/brackets/admin/categoryCanonical'
import { TEST_CONSOLIDATION_POLICY } from '../lib/brackets/consolidation/__tests__/fixtures'

async function main() {
  const gen = await prisma.bracketGeneration.findFirst({ where: { status: 'ACTIVE' } })
  if (!gen) {
    console.log('No ACTIVE generation')
    return
  }
  console.log('generation', gen.id, gen.version)

  const preview = await previewConsolidation({
    expectedVersion: gen.version,
    policy: TEST_CONSOLIDATION_POLICY,
  })
  console.log('preview moves', preview.plan.finalPlacements.length)

  if (preview.plan.finalPlacements.length === 0) {
    console.log('No moves to apply')
    return
  }

  try {
    const result = await applyConsolidation({
      expectedVersion: gen.version,
      policy: preview.policy,
      consolidationPlanToken: preview.consolidationPlanToken,
    })
    console.log('apply ok', result.movedCount)

    const diff = await computeDiffForDraft(result.draft.id)
    console.log('diff ok', diff !== null)

    const categories = await buildCategoriesCanonicalDto(
      result.draft.id,
      result.affectedCategoryKeys,
    )
    console.log('categories ok', categories.length)
  } catch (error) {
    console.error('FAILED', error)
    process.exitCode = 1
  }
}

main().finally(async () => {
  await prisma.$disconnect()
})
