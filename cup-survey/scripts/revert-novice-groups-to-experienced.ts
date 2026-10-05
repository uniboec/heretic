#!/usr/bin/env npx tsx
/**
 * Revert 3 novice bracket groups back to experienced (reverse of convert-novice-groups-from-experienced).
 * npx tsx scripts/revert-novice-groups-to-experienced.ts [--dry-run]
 */
import { prisma } from '../lib/prisma'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { acquireBracketWriteLocks } from '../lib/brackets/live/locks'
import { forceRebuildCategories } from '../lib/brackets/live/forceRebuild'
import { publishBracketDraft } from '../lib/brackets/generation/publish'
import { setCategoriesBoutsReleased } from '../lib/bouts/release'
import { setCategoriesPublicVisibility } from '../lib/brackets/generation/categoryVisibility'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'
import { formatAthleteFullName } from '../lib/registration/athleteName'
import '../lib/brackets/systems'

const EXPERIENCED_KEYS = [
  'close_control:experienced:m_youths_1:m_youths_1_w_le_41',
  'close_control:experienced:m_boys_1:m_boys_1_w_le_20',
  'tactic_control:experienced:m_boys_1:m_boys_1_w_le_20',
] as const

const dryRun = process.argv.includes('--dry-run')

function toNoviceKey(experiencedKey: string): string {
  return experiencedKey.replace(':experienced:', ':novice:')
}

async function printDrawState(generationId: string, label: string) {
  const keys = [...EXPERIENCED_KEYS, ...EXPERIENCED_KEYS.map(toNoviceKey)]
  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId, categoryKey: { in: keys } },
    include: {
      participants: { orderBy: { seedPosition: 'asc' } },
      publicationState: true,
    },
  })
  console.log(`\n=== ${label} ===`)
  for (const key of keys) {
    const draw = draws.find((d) => d.categoryKey === key)
    if (!draw) {
      console.log(`  — ${getCategoryTitleFromKey(key)}`)
      continue
    }
    const names: string[] = []
    for (const p of draw.participants) {
      const entry = await prisma.athleteEntry.findUnique({
        where: { id: p.entryId },
        include: { athlete: true },
      })
      names.push(entry ? formatAthleteFullName(entry.athlete) : p.entryId)
    }
    console.log(
      `  ${getCategoryTitleFromKey(key)} · ${draw.participants.length} чел.` +
        (draw.publicationState?.boutsReleased ? ' · в расписании' : '') +
        (draw.publicationState?.visible ? ' · на сайте' : ''),
    )
    if (names.length) console.log(`    ${names.join(', ')}`)
  }
}

async function main() {
  const draft = await requireWorkingGeneration(prisma)
  const noviceKeys = EXPERIENCED_KEYS.map(toNoviceKey)
  const affectedKeys = [...new Set([...EXPERIENCED_KEYS, ...noviceKeys])]

  await printDrawState(draft.id, 'Before')

  const noviceDraws = await prisma.bracketCategoryDraw.findMany({
    where: {
      generationId: draft.id,
      categoryKey: { in: [...noviceKeys] },
    },
    include: { participants: true },
  })

  const moves: Array<{ entryId: string; fromKey: string; toKey: string }> = []
  for (const experiencedKey of EXPERIENCED_KEYS) {
    const noviceKey = toNoviceKey(experiencedKey)
    const draw = noviceDraws.find((d) => d.categoryKey === noviceKey)
    if (!draw?.participants.length) {
      console.warn(`Warning: no participants in ${getCategoryTitleFromKey(noviceKey)}`)
      continue
    }
    for (const participant of draw.participants) {
      moves.push({
        entryId: participant.entryId,
        fromKey: noviceKey,
        toKey: experiencedKey,
      })
    }
  }

  console.log(`\nPlacements to experienced: ${moves.length}`)

  if (dryRun) {
    console.log('\n[DRY RUN] Would set placements, rebuild, publish, release experienced groups.')
    return
  }

  let version = draft.version
  await prisma.$transaction(async (tx) => {
    const ctx = await acquireBracketWriteLocks(tx, {
      scope: 'destructive_admin',
      categoryKeys: affectedKeys,
    })
    if (ctx.generation.version !== version) {
      throw new Error(`Version conflict: expected ${version}, got ${ctx.generation.version}`)
    }

    for (const move of moves) {
      await tx.bracketEntryPlacement.upsert({
        where: { entryId: move.entryId },
        create: {
          entryId: move.entryId,
          categoryKey: move.toKey,
          isManualMove: true,
          movedAt: new Date(),
        },
        update: {
          categoryKey: move.toKey,
          isManualMove: true,
          movedAt: new Date(),
        },
      })
      await tx.bracketMoveAudit.create({
        data: {
          entryId: move.entryId,
          action: 'MOVE',
          fromCategoryKey: move.fromKey,
          toCategoryKey: move.toKey,
          movedBy: 'script:revert-novice-groups-to-experienced',
        },
      })
    }

    await forceRebuildCategories(tx, {
      generationId: ctx.generation.id,
      categoryKeys: affectedKeys,
      preserveVisible: true,
    })

    const updated = await tx.bracketGeneration.update({
      where: { id: ctx.generation.id },
      data: { version: ctx.generation.version + 1 },
    })
    version = updated.version
  })

  console.log(`\nRebuilt → version ${version}`)

  const published = await publishBracketDraft({ draftId: draft.id, expectedVersion: version })
  version = published.draft.version
  console.log(`Published → version ${version}`)

  await prisma.bracketPageSetting.update({
    where: { id: 'default' },
    data: { publicEnabled: true },
  })
  await prisma.boutsPageSetting.update({
    where: { id: 'default' },
    data: { publicEnabled: true },
  })

  for (const categoryKey of EXPERIENCED_KEYS) {
    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey,
      visible: true,
    })
  }

  for (const categoryKey of EXPERIENCED_KEYS) {
    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: draft.id, categoryKey },
      include: { publicationState: true },
    })
    if (!draw?.publicationState) continue
    await setCategoriesBoutsReleased({
      scope: 'category',
      categoryKey,
      released: true,
      expectedPublishedDrawId: draw.publicationState.publishedDrawId,
      expectedPublishedGenerationId: draft.id,
    })
    console.log(`Released bouts: ${getCategoryTitleFromKey(categoryKey)}`)
  }

  const readyRelease = await setCategoriesBoutsReleased({
    scope: 'ready',
    released: true,
    expectedPublishedGenerationId: draft.id,
  })
  console.log(`Restored ready schedule: ${readyRelease.affectedCategoryKeys?.length ?? 0} categories`)

  await printDrawState(draft.id, 'After')

  const remainingNovice = await prisma.bracketCategoryDraw.count({
    where: { generationId: draft.id, categoryKey: { in: [...noviceKeys] } },
  })
  if (remainingNovice > 0) {
    throw new Error(`Expected novice draws to be removed, still have ${remainingNovice}`)
  }

  console.log('\nDone. 3 groups restored to experienced with draw + schedule.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
