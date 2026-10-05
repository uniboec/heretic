import { prisma } from '../lib/prisma'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { getAdminLiveCategoryStructure, getPublicBrackets } from '../lib/brackets/service'
import type { BracketStructure } from '../lib/brackets/core/types'

type MatchLike = { id?: string; winnerEntryId?: string | null }

function matchList(structure: BracketStructure): MatchLike[] {
  if (Array.isArray(structure.rounds)) return structure.rounds
  if (Array.isArray((structure as { matches?: MatchLike[] }).matches)) {
    return (structure as { matches: MatchLike[] }).matches
  }
  return []
}

async function main() {
  const activeResults = await prisma.boutResult.findMany({
    where: { isCurrent: true, resultStatus: 'ACTIVE' },
    select: {
      boutId: true,
      winnerEntryId: true,
      loserEntryId: true,
      victoryMethod: true,
      resultConfirmedAt: true,
    },
    orderBy: { resultConfirmedAt: 'asc' },
  })

  console.log('=== ACTIVE BOUT RESULTS ===')
  console.log('count:', activeResults.length)
  console.log('with winner:', activeResults.filter((r) => r.winnerEntryId).length)

  const boutIdSet = new Set(activeResults.map((r) => r.boutId))
  function resolveMatchBoutId(categoryKey: string, localId: string | undefined): string | null {
    if (!localId) return null
    if (boutIdSet.has(localId)) return localId
    const qualified = `${categoryKey}::${localId}`
    if (boutIdSet.has(qualified)) return qualified
    return null
  }

  const publishedDraws = await prisma.bracketCategoryDraw.findMany({
    where: { publishedStructureJson: { not: null } },
    include: {
      publicationState: true,
      participants: { select: { entryId: true, snapshotDisplayName: true } },
    },
  })

  const complete: Array<Record<string, unknown>> = []
  const inProgress: Array<Record<string, unknown>> = []
  const stale: Array<Record<string, unknown>> = []

  for (const draw of publishedDraws) {
    const structure = draw.publishedStructureJson as BracketStructure | null
    if (!structure) continue

    const result = readCategoryResult(structure, draw.autoSystemId)
    const matches = matchList(structure)
    const matchedBoutIds = matches
      .map((m) => resolveMatchBoutId(draw.categoryKey, m.id))
      .filter((id): id is string => Boolean(id))
    const withWinners = matches.filter((m) => m.winnerEntryId).length
    const confirmedInCat = activeResults.filter((r) => matchedBoutIds.includes(r.boutId))

    const row = {
      categoryKey: draw.categoryKey,
      title: draw.title,
      system: draw.autoSystemId,
      visible: draw.publicationState?.visible ?? false,
      resultStatus: result?.status ?? 'none',
      placements: result?.placements?.length ?? 0,
      matchesWithWinner: withWinners,
      confirmedBouts: confirmedInCat.length,
      totalBouts: matchList(structure).length,
    }

    if (result?.status === 'complete') complete.push(row)
    else if (result?.status === 'in_progress') inProgress.push(row)
    if (confirmedInCat.length > 0 && withWinners < confirmedInCat.length) stale.push(row)
  }

  console.log('\n=== PUBLISHED CATEGORIES ===')
  console.log('total published:', publishedDraws.length)
  console.log('complete (podium known):', complete.length)
  console.log('in_progress:', inProgress.length)
  console.log('possibly stale (confirmed bouts not in structure):', stale.length)

  if (complete.length > 0) {
    console.log('\n--- COMPLETE CATEGORIES ---')
    for (const c of complete) {
      const draw = publishedDraws.find((d) => d.categoryKey === c.categoryKey)
      const structure = draw?.publishedStructureJson as BracketStructure
      const result = readCategoryResult(structure, draw?.autoSystemId)
      const names = new Map(draw?.participants.map((p) => [p.entryId, p.snapshotDisplayName]))
      console.log(c.title)
      console.log('  key:', c.categoryKey)
      console.log('  system:', c.system, '| visible:', c.visible)
      console.log(
        '  placements:',
        result?.placements
          ?.map((p) => `${p.placement}: ${names.get(p.entryId) ?? p.entryId} (${p.reason})`)
          .join('; '),
      )
    }
  }

  if (inProgress.length > 0) {
    console.log('\n--- IN PROGRESS (partial results) ---')
    for (const c of inProgress) {
      console.log(
        `${c.title} | confirmed: ${c.confirmedBouts}/${c.totalBouts} | winners in JSON: ${c.matchesWithWinner}`,
      )
    }
  }

  if (stale.length > 0) {
    console.log('\n--- STALE (confirmed results missing from published JSON) ---')
    for (const c of stale) {
      console.log(
        `${c.title} | confirmed: ${c.confirmedBouts} | winners in JSON: ${c.matchesWithWinner}`,
      )
    }
  }

  const affectedCategories = new Map<
    string,
    { title: string; system: string | null; boutIds: string[] }
  >()

  function categoryKeyFromBoutId(boutId: string): string | null {
    const idx = boutId.lastIndexOf('::bout-')
    if (idx === -1) return null
    return boutId.slice(0, idx)
  }

  for (const result of activeResults) {
    const categoryKey = categoryKeyFromBoutId(result.boutId)
    if (!categoryKey) continue
    const existing = affectedCategories.get(categoryKey)
    if (existing) {
      existing.boutIds.push(result.boutId)
      continue
    }
    const draw = publishedDraws.find((d) => d.categoryKey === categoryKey)
    affectedCategories.set(categoryKey, {
      title: draw?.title ?? categoryKey,
      system: draw?.autoSystemId ?? null,
      boutIds: [result.boutId],
    })
  }

  console.log('\n=== CATEGORIES WITH CONFIRMED BOUTS ===')
  console.log('categories touched by confirmed results:', affectedCategories.size)
  for (const [key, info] of affectedCategories) {
    const draw = publishedDraws.find((d) => d.categoryKey === key)
    if (!draw) {
      console.log(`\n${info.title}`)
      console.log('  key:', key)
      console.log('  ⚠ категория не найдена среди published draws')
      console.log('  confirmed bouts:', info.boutIds.join(', '))
      continue
    }

    const live = await getAdminLiveCategoryStructure(key)
    const stored = readCategoryResult(
      draw.publishedStructureJson as BracketStructure,
      info.system,
    )
    const winnersInLive = matchList(live.structure).filter((m) => m.winnerEntryId).length
    const winnersInStored = matchList(draw.publishedStructureJson as BracketStructure).filter(
      (m) => m.winnerEntryId,
    ).length
    console.log(`\n${info.title}`)
    console.log('  key:', key)
    console.log('  system:', info.system, '| visible:', draw.publicationState?.visible ?? false)
    console.log('  confirmed bouts:', info.boutIds.join(', '))
    console.log('  stored result:', stored?.status ?? 'none', '| placements:', stored?.placements?.length ?? 0)
    console.log(
      '  live result:',
      live.result?.status ?? 'none',
      '| placements:',
      live.result?.placements?.length ?? 0,
    )
    console.log(
      '  winners in stored JSON:',
      winnersInStored,
      '| winners in live structure:',
      winnersInLive,
      '/',
      matchList(live.structure).length,
      'bouts',
    )
    if (live.result?.placements && live.result.placements.length > 0) {
      const names = new Map(live.participants.map((p) => [p.entryId, p.displayName]))
      console.log(
        '  podium:',
        live.result.placements
          .map((p) => `${p.placement}: ${names.get(p.entryId) ?? p.entryId}`)
          .join('; '),
      )
    }
  }

  const orphanResults = activeResults.filter(
    (r) => !Array.from(affectedCategories.values()).some((c) => c.boutIds.includes(r.boutId)),
  )
  if (orphanResults.length > 0) {
    console.log('\n--- CONFIRMED BOUTS NOT FOUND IN PUBLISHED STRUCTURES ---')
    for (const r of orphanResults) {
      console.log(r.boutId, '→', r.winnerEntryId, `(${r.victoryMethod})`)
    }
  }

  const affectedKeys = new Set(affectedCategories.keys())
  const publicData = await getPublicBrackets()
  const publicAffected = (publicData.categories ?? []).filter((c) => affectedKeys.has(c.categoryKey))
  console.log('\n=== PUBLIC API FOR CATEGORIES WITH YOUR BOUTS ===')
  for (const cat of publicAffected) {
    const winners = matchList(cat.structure as BracketStructure).filter((m) => m.winnerEntryId).length
    const names = new Map(cat.participants.map((p) => [p.entryId, p.displayName]))
    console.log(`\n${cat.title}`)
    console.log('  key:', cat.categoryKey)
    console.log('  result:', cat.result?.status ?? 'none')
    console.log('  winners in structure:', winners)
    if (cat.result?.placements?.length) {
      console.log(
        '  podium:',
        cat.result.placements
          .map((p) => `${p.placement}: ${names.get(p.entryId) ?? p.entryId}`)
          .join('; '),
      )
    }
  }

  const publicComplete = (publicData.categories ?? []).filter((c) => c.result?.status === 'complete')
  console.log('\n=== PUBLIC API (with lazy reconcile) ===')
  console.log('published:', publicData.published)
  console.log('categories:', publicData.categories?.length ?? 0)
  console.log('complete via API:', publicComplete.length)
  if (publicComplete.length > 0) {
    console.log('\n--- COMPLETE ON PUBLIC API ---')
    for (const cat of publicComplete) {
      console.log(
        cat.title,
        '→',
        cat.result?.placements
          ?.map((p) => `${p.placement}`)
          .join(', '),
      )
    }
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
