#!/usr/bin/env npx tsx
/**
 * Safe post-manual-ops sync (preserves placements) + release specific categories to schedule.
 * Usage: npx tsx scripts/sync-stale-and-release-bouts.ts [--dry-run]
 */
import { prisma } from '../lib/prisma'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { redrawBracketDraft } from '../lib/brackets/generation/redraw'
import { publishBracketDraft } from '../lib/brackets/generation/publish'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { computeDiffForDraft } from '../lib/brackets/dashboardDiff'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'
import { categoryRequiresBouts } from '../lib/brackets/core/categoryRequiresBouts'
import { setCategoriesBoutsReleased } from '../lib/bouts/release'
import { setCategoriesPublicVisibility } from '../lib/brackets/generation/categoryVisibility'
import '../lib/brackets/systems'

const RELEASE_CATEGORY_KEYS = [
  'tactic_control:experienced:m_boys_3:m_boys_3_w_le_32',
  'tactic_control:experienced:m_youths_3:m_youths_3_w_le_66',
  'close_control:experienced:m_men_1:m_men_1_w_le_71',
  'close_control:experienced:m_youths_2:m_youths_2_w_le_38',
]

const dryRun = process.argv.includes('--dry-run')

async function printState(label: string, generationId: string) {
  const diff = await computeDiffForDraft(generationId)
  const staleCount = Object.values(diff.categories).filter(
    (c) => c.compositionStale || c.seedingStale,
  ).length
  console.log(`\n=== ${label} ===`)
  console.log(`  globalCompositionStale: ${diff.globalCompositionStale}`)
  console.log(`  registrationDataStale: ${diff.registrationDataStale}`)
  console.log(`  stale categories: ${staleCount}`)

  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId, status: 'ACTIVE' },
    include: { participants: true, publicationState: true },
  })
  const unreleased = draws.filter((d) =>
    categoryRequiresBouts({
      status: d.status,
      autoSystemId: d.autoSystemId,
      systemOverride: d.systemOverride,
      participantCount: d.participants.length,
    }) && !d.publicationState?.boutsReleased,
  )
  console.log(`  unreleased (need bouts): ${unreleased.length}`)
  for (const d of unreleased) {
    console.log(`    · ${getCategoryTitleFromKey(d.categoryKey)} (${d.participants.length})`)
  }
}

async function main() {
  const placementsBefore = await prisma.bracketEntryPlacement.count()
  let draft = await requireWorkingGeneration(prisma)
  console.log(`Draft ${draft.id}, version ${draft.version}, placements: ${placementsBefore}`)

  await printState('Before', draft.id)

  if (dryRun) {
    console.log('\n[DRY RUN] Would sync with afterRegistrationChange=true (preserves placements)')
    console.log('[DRY RUN] Would publish if needed, then release:')
    for (const key of RELEASE_CATEGORY_KEYS) {
      console.log(`  · ${getCategoryTitleFromKey(key)}`)
    }
    return
  }

  const synced = await syncBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'all',
    afterRegistrationChange: true,
  })
  draft = synced.draft
  console.log(`\nSynced → version ${draft.version}, warnings: ${synced.warnings.length}`)

  const placementsAfter = await prisma.bracketEntryPlacement.count()
  if (placementsAfter !== placementsBefore) {
    throw new Error(
      `Placements changed: ${placementsBefore} → ${placementsAfter} (expected preserved)`,
    )
  }
  console.log(`Placements preserved: ${placementsAfter}`)

  const redrawn = await redrawBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'all',
    onlyStale: true,
  })
  draft = redrawn.draft
  console.log(`Redrawn stale → version ${draft.version}`)

  await printState('After sync', draft.id)

  console.log('\nPublishing draft…')
  const pub = await publishBracketDraft({ draftId: draft.id, expectedVersion: draft.version })
  draft = { id: pub.publishedGenerationId, version: pub.draft.version }
  console.log(`Published → version ${draft.version}`)

  await prisma.bracketPageSetting.update({
    where: { id: 'default' },
    data: { publicEnabled: true },
  })
  await prisma.boutsPageSetting.update({
    where: { id: 'default' },
    data: { publicEnabled: true },
  })

  // Publish resets boutsReleased when draw ids change — restore all ready + target categories.
  const readyRelease = await setCategoriesBoutsReleased({
    scope: 'ready',
    released: true,
    expectedPublishedGenerationId: draft.id,
  })
  console.log(`Ready categories released: ${readyRelease.affectedCategoryKeys?.length ?? 0}`)

  for (const categoryKey of RELEASE_CATEGORY_KEYS) {
    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey,
      visible: true,
    })
  }

  const pairs = await prisma.bracketCategoryDraw.findMany({
    where: { generationId: draft.id, categoryKey: { in: RELEASE_CATEGORY_KEYS } },
    include: { publicationState: true },
  })
  const pairByKey = new Map(pairs.map((p) => [p.categoryKey, p]))

  const releasedKeys: string[] = []
  for (const categoryKey of RELEASE_CATEGORY_KEYS) {
    const draw = pairByKey.get(categoryKey)
    if (!draw?.publicationState) {
      throw new Error(`Category not found or not published: ${categoryKey}`)
    }
    if (draw.publicationState.boutsReleased) {
      console.log(`In schedule: ${getCategoryTitleFromKey(categoryKey)}`)
      continue
    }
    const result = await setCategoriesBoutsReleased({
      scope: 'category',
      categoryKey,
      released: true,
      expectedPublishedDrawId: draw.publicationState.publishedDrawId,
      expectedPublishedGenerationId: draft.id,
    })
    if (!result.noop) {
      releasedKeys.push(categoryKey)
      console.log(`Released: ${getCategoryTitleFromKey(categoryKey)}`)
    }
  }

  await printState('Final', draft.id)
  console.log(`\nDone. Newly released: ${releasedKeys.length}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
