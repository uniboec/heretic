#!/usr/bin/env npx tsx
/**
 * Audit seeding/balance staleness and optionally redraw stale categories.
 * npx tsx scripts/audit-and-fix-seeding.ts [--fix]
 */
import { prisma } from '../lib/prisma'
import { computeDiffForDraft } from '../lib/brackets/dashboardDiff'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'
import { redrawBracketDraft } from '../lib/brackets/generation/redraw'
import { publishBracketDraft } from '../lib/brackets/generation/publish'
import { setCategoriesBoutsReleased } from '../lib/bouts/release'
import '../lib/brackets/systems'

const fix = process.argv.includes('--fix')

async function listStale(generationId: string) {
  const diff = await computeDiffForDraft(generationId)
  if (!diff) return { diff: null, stale: [] as string[] }

  const stale = Object.entries(diff.categories)
    .filter(([, c]) => c.seedingStale || c.balanceStale)
    .map(([key, c]) => ({
      key,
      title: getCategoryTitleFromKey(key),
      seedingStale: c.seedingStale,
      balanceStale: c.balanceStale,
    }))

  return { diff, stale }
}

async function main() {
  const draft = await requireWorkingGeneration(prisma)
  console.log(`Generation ${draft.id}, version ${draft.version}`)

  const { diff, stale } = await listStale(draft.id)
  if (!diff) {
    console.log('No diff')
    return
  }

  console.log(`\nStale seeding/balance: ${stale.length}`)
  for (const item of stale) {
    const flags = [
      item.seedingStale ? 'seeding' : null,
      item.balanceStale ? 'balance' : null,
    ]
      .filter(Boolean)
      .join('+')
    console.log(`  · [${flags}] ${item.title}`)
  }

  if (!fix) {
    if (stale.length > 0) {
      console.log('\nRun with --fix to redraw stale categories, publish, and restore schedule.')
    }
    return
  }

  if (stale.length === 0) {
    console.log('\nNothing to fix.')
    return
  }

  let version = draft.version
  const redrawn = await redrawBracketDraft({
    draftId: draft.id,
    expectedVersion: version,
    scope: 'all',
    onlyStale: true,
  })
  version = redrawn.draft.version
  console.log(`\nRedrawn → version ${version}`)

  const afterRedraw = await listStale(draft.id)
  console.log(`Remaining stale: ${afterRedraw.stale.length}`)

  const published = await publishBracketDraft({ draftId: draft.id, expectedVersion: version })
  version = published.draft.version
  console.log(`Published → version ${version}`)

  const releaseResult = await setCategoriesBoutsReleased({
    scope: 'ready',
    released: true,
    expectedPublishedGenerationId: draft.id,
  })
  console.log(`Released to schedule: ${releaseResult.affectedCategoryKeys?.length ?? 0}`)

  const final = await listStale(draft.id)
  console.log(`Final stale count: ${final.stale.length}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
