import type { BracketExportCategory } from '../export/types'
import type { PrintModel, PrintPage } from './types'
import { buildChampionSheetPage } from './layouts/championSheet'
import { buildHeadToHeadPage } from './layouts/headToHead'
import { buildOlympicFourPage } from './layouts/olympicFourWithBronze'
import { buildOlympicRoundGroups, buildOlympicTreePage } from './layouts/olympicTree'
import { buildRoundRobinPage } from './layouts/roundRobinSheet'
import { buildThreePlayerComebackPage } from './layouts/threePlayerComeback'
import { buildCategoryMetaLine } from './formatCategoryMeta'
import { effectiveBronzeMode } from './bronze/resolveOlympicBronzePrint'
import { assignCrossPageAnchors } from './splitPrintPages'
import { resolveCategoryPageLayout } from '../export/resolveCategoryPageLayout'

function buildOlympicPages(category: BracketExportCategory): PrintPage[] {
  if (category.participantCount === 2) {
    return [buildHeadToHeadPage(category)]
  }
  if (category.participantCount === 4) {
    return [buildOlympicFourPage(category)]
  }

  const structure = category.structure
  const maxRound = structure.rounds.reduce((max, m) => Math.max(max, m.round), 1)
  const firstRoundMatchCount = structure.rounds.filter((m) => m.round === 1).length
  const layout = resolveCategoryPageLayout(category)
  const groups = layout.olympicRoundGroups ?? buildOlympicRoundGroups(maxRound, firstRoundMatchCount)
  const pageCount = groups.length

  return groups.map((group, pageIndex) =>
    buildOlympicTreePage({
      category,
      roundFrom: group[0],
      roundTo: group[1],
      pageIndex,
      pageCount,
      includeBronze: pageIndex === pageCount - 1,
      includePlacements: pageIndex === pageCount - 1,
    }),
  )
}

export function buildBracketPrintModel(category: BracketExportCategory): PrintModel {
  const systemId = category.effectiveSystemId ?? category.structure.systemId
  let pages: PrintPage[]

  switch (systemId) {
    case 'champion':
      pages = [buildChampionSheetPage(category)]
      break
    case 'three_way':
      pages = [buildThreePlayerComebackPage(category)]
      break
    case 'round_robin':
      pages = [buildRoundRobinPage(category)]
      break
    case 'olympic':
      pages = buildOlympicPages(category)
      break
    default:
      pages = [buildChampionSheetPage(category)]
  }

  const orientation = pages[0]?.orientation ?? 'portrait'
  const paged = assignCrossPageAnchors(pages)

  return {
    categoryKey: category.categoryKey,
    title: category.title,
    metaLine: buildCategoryMetaLine(category),
    systemId,
    effectiveBronzeMode: effectiveBronzeMode(category),
    orientation,
    pages: paged,
  }
}

export { splitPrintPages } from './splitPrintPages'
