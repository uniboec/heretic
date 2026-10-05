import type { BracketExportCategory } from '../../export/types'
import {
  buildOlympicConnectorPaths,
  getMatchCenterY,
  getOlympicBracketViewBox,
  getOlympicRoundLabel,
  getSlotHeightPx,
} from '../../layout/olympicGeometry'
import type { PrintPage } from '../types'
import { effectiveBronzeMode, resolveOlympicBronzePrint } from '../bronze/resolveOlympicBronzePrint'
import { buildPageChrome, pageContinuationBanner } from '../formatCategoryMeta'
import { buildSlotContext, resolvePlacementSlot } from '../resolvePrintSlots'
import { buildMatchNode } from './layoutUtils'
import {
  A4_LANDSCAPE,
  PRINT_MATCH_WIDTH,
  PRINT_PAGE_CHROME_HEIGHT,
  PRINT_PAGE_MARGIN,
} from '../printTheme'

export function buildOlympicTreePage(input: {
  category: BracketExportCategory
  roundFrom: number
  roundTo: number
  pageIndex: number
  pageCount: number
  includeBronze: boolean
  includePlacements: boolean
}): PrintPage {
  const { category, roundFrom, roundTo, pageIndex, pageCount, includeBronze, includePlacements } = input
  const ctx = buildSlotContext(category)
  const structure = category.structure
  const maxRound = structure.rounds.reduce((max, m) => Math.max(max, m.round), 1)
  const firstRoundMatchCount = structure.rounds.filter((m) => m.round === 1).length
  const isCompact = firstRoundMatchCount <= 2
  const slotHeightPx = getSlotHeightPx(firstRoundMatchCount, isCompact)
  const viewBox = getOlympicBracketViewBox(maxRound, firstRoundMatchCount, slotHeightPx, isCompact)

  const rounds = Array.from({ length: maxRound }, (_, i) => i + 1).filter(
    (r) => r >= roundFrom && r <= roundTo,
  )

  const { columnWidthPx, connectorGapPx, labelAreaPx } = {
    columnWidthPx: 240,
    connectorGapPx: 48,
    labelAreaPx: 36,
  }

  const matches = []
  const startX = PRINT_PAGE_MARGIN
  const startY = PRINT_PAGE_MARGIN + PRINT_PAGE_CHROME_HEIGHT + labelAreaPx

  for (let col = 0; col < rounds.length; col++) {
    const round = rounds[col]!
    const roundMatches = structure.rounds.filter((m) => m.round === round).sort((a, b) => a.slot - b.slot)
    const label = getOlympicRoundLabel(round, maxRound, roundMatches.length)
    const colX = startX + col * (columnWidthPx + connectorGapPx)

    for (const match of roundMatches) {
      const indexInRound = match.slot - 1
      const centerY = getMatchCenterY(round, indexInRound, firstRoundMatchCount, slotHeightPx)
      const y = startY + centerY - 40
      matches.push(buildMatchNode(ctx, match, { x: colX, y }, label))
    }
  }

  const pageRoundFrom = rounds[0]
  const pageRoundTo = rounds[rounds.length - 1]
  const roundRangeLabel =
    pageRoundFrom && pageRoundTo
      ? pageRoundFrom === pageRoundTo
        ? getOlympicRoundLabel(pageRoundFrom, maxRound, structure.rounds.filter((m) => m.round === pageRoundFrom).length)
        : `${getOlympicRoundLabel(pageRoundFrom, maxRound, structure.rounds.filter((m) => m.round === pageRoundFrom).length)} → ${getOlympicRoundLabel(pageRoundTo, maxRound, structure.rounds.filter((m) => m.round === pageRoundTo).length)}`
      : undefined

  const connectorPaths = buildOlympicConnectorPaths(
    Math.min(roundTo, maxRound) - roundFrom + 1 > 0 ? roundTo - roundFrom + 1 : 1,
    firstRoundMatchCount / 2 ** (roundFrom - 1),
    slotHeightPx,
    isCompact,
  ).map((p) => {
    const offsetX = startX
    const offsetY = startY - labelAreaPx
    return p.replace(/(\d+\.?\d*)/g, (n, num) => {
      const v = parseFloat(num)
      if (Number.isNaN(v)) return n
      return String(v + (p.indexOf(num) < 20 ? offsetX : offsetY))
    })
  })

  const contentHeight = viewBox.height + PRINT_PAGE_CHROME_HEIGHT
  const bronzeY = contentHeight - 120
  const bronze = includeBronze
    ? resolveOlympicBronzePrint(category, effectiveBronzeMode(category), bronzeY)
    : { mode: 'NONE' as const }

  const showThird = effectiveBronzeMode(category) !== null
  const placements = includePlacements
    ? [
        { placement: 1 as const, slot: resolvePlacementSlot(ctx, 1) },
        { placement: 2 as const, slot: resolvePlacementSlot(ctx, 2) },
        ...(showThird ? [{ placement: 3 as const, slot: resolvePlacementSlot(ctx, 3) }] : []),
      ]
    : []

  return {
    layoutKind: 'olympicTree',
    orientation: 'landscape',
    viewBoxWidth: A4_LANDSCAPE.width,
    viewBoxHeight: Math.max(A4_LANDSCAPE.height, contentHeight + 80),
    chrome: buildPageChrome({
      category,
      pageIndex,
      pageCount,
      roundRangeLabel,
      continuationBanner: pageContinuationBanner(pageIndex, pageCount),
    }),
    connectorPaths,
    matches,
    placements,
    bronze,
  }
}

export function buildOlympicRoundGroups(maxRound: number, firstRoundMatchCount: number): Array<[number, number]> {
  if (maxRound <= 3 && firstRoundMatchCount <= 8) return [[1, maxRound]]
  if (maxRound <= 4) {
    const mid = Math.ceil(maxRound / 2)
    return [
      [1, mid],
      [mid + 1, maxRound],
    ]
  }
  const groups: Array<[number, number]> = []
  for (let start = 1; start <= maxRound; start += 2) {
    groups.push([start, Math.min(start + 1, maxRound)])
  }
  return groups
}
