import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { previewConsolidation } from '../lib/brackets/consolidation/apply'
import { normalizePolicy } from '../lib/brackets/consolidation/policyHash'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'
import type { LegacyConsolidationPolicyInput } from '../lib/brackets/consolidation/types'

const USER_POLICY = normalizePolicy({
  incompleteThreshold: 1,
  steps: [
    { type: 'WEIGHT_UP', enabled: true },
    { type: 'EXPERIENCE_UP', enabled: true },
    { type: 'AGE_UP', enabled: true, weightMapping: 'SAME_INDEX' },
  ],
} satisfies LegacyConsolidationPolicyInput)

async function main() {
  const gen = await prisma.bracketGeneration.findFirst({ where: { status: 'ACTIVE' } })
  if (!gen) {
    console.log('No ACTIVE generation')
    return
  }

  const preview = await previewConsolidation({
    expectedVersion: gen.version,
    policy: USER_POLICY,
  })

  const movedIds = new Set(preview.plan.finalPlacements.map((p) => p.entryId))
  const skippedEntryIds = preview.plan.skipped.flatMap((item) => item.entryIds ?? [])
  const entryById = new Map(preview.entries.map((e) => [e.entryId, e]))

  console.log('=== Consolidation preview analysis ===')
  console.log('moved:', preview.plan.finalPlacements.length)
  console.log('skipped records:', preview.plan.skipped.length)
  console.log('skipped athletes:', skippedEntryIds.length)
  console.log('unique skipped athletes:', new Set(skippedEntryIds).size)

  const movedAlsoInSkipped = skippedEntryIds.filter((id) => movedIds.has(id))
  console.log('moved athletes also listed in skipped:', movedAlsoInSkipped.length)

  if (movedAlsoInSkipped.length > 0) {
    console.log('\nMoved but also in skipped:')
    for (const id of movedAlsoInSkipped.slice(0, 10)) {
      console.log(' -', entryById.get(id)?.displayName ?? id)
    }
  }

  const byCategory = new Map<string, number>()
  for (const item of preview.plan.skipped) {
    byCategory.set(item.categoryKey, (byCategory.get(item.categoryKey) ?? 0) + 1)
  }
  const repeatedCategories = [...byCategory.entries()].filter(([, count]) => count > 1)
  console.log('\ncategories appearing in skipped multiple times:', repeatedCategories.length)

  const multiAthleteSkipped = preview.plan.skipped.filter(
    (item) => (item.entryIds?.length ?? 0) > 1,
  )
  console.log('skipped records with >1 athlete (threshold=1):', multiAthleteSkipped.length)

  if (multiAthleteSkipped.length > 0) {
    console.log('\nExamples with multiple athletes:')
    for (const item of multiAthleteSkipped.slice(0, 5)) {
      console.log(
        getCategoryTitleFromKey(item.categoryKey),
        '·',
        item.step,
        '·',
        item.entryIds?.length,
        'athletes',
      )
    }
  }

  // Compute correct final skipped from plan final state
  const { loadConsolidationPlanContext } = await import('../lib/brackets/consolidation/context')
  const { buildVirtualComposition } = await import('../lib/brackets/consolidation/plan')

  function isIncomplete(count: number, threshold: number) {
    return count > 0 && count <= threshold
  }

  await prisma.$transaction(async (tx) => {
    const ctx = await loadConsolidationPlanContext(tx, {
      generationId: gen.id,
      policy: USER_POLICY,
    })

    const plan = ctx.plan
    const initialVirtual = buildVirtualComposition(
      ctx.eligible.map((e) => ({
        entryId: e.entryId,
        effectiveCategoryKey: e.effectiveCategoryKey,
      })),
    )

    const finalVirtual = new Map<string, string[]>()
    for (const [key, ids] of initialVirtual) {
      finalVirtual.set(key, [...ids])
    }
    for (const placement of plan.finalPlacements) {
      for (const [key, ids] of finalVirtual) {
        const index = ids.indexOf(placement.entryId)
        if (index >= 0) {
          ids.splice(index, 1)
          if (ids.length === 0) finalVirtual.delete(key)
          break
        }
      }
      const target = finalVirtual.get(placement.finalCategoryKey) ?? []
      target.push(placement.entryId)
      finalVirtual.set(placement.finalCategoryKey, target)
    }

    let finalSkippedCats = 0
    let finalSkippedAthletes = 0
    for (const [, entryIds] of finalVirtual) {
      if (isIncomplete(entryIds.length, USER_POLICY.incompleteThreshold)) {
        finalSkippedCats += 1
        finalSkippedAthletes += entryIds.length
      }
    }

    console.log('\nCorrect final incomplete categories:', finalSkippedCats)
    console.log('Correct final skipped athletes:', finalSkippedAthletes)
  })
}

main().finally(async () => {
  await prisma.$disconnect()
})
