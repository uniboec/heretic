import 'server-only'

import type { BracketStructure } from '../core/types'
import {
  getOlympicLayout,
  getOlympicBracketViewBox,
  getSlotHeightPx,
} from '../layout/olympicGeometry'
import type { BracketCategoryPageLayout, BracketExportCategory } from './types'

const A4_PRINTABLE_WIDTH_PORTRAIT_TWIPS = 9638
const A4_PRINTABLE_WIDTH_LANDSCAPE_TWIPS = 13500
const MIN_READABLE_COLUMN_WIDTH_TWIPS = 1800

function estimateOlympicWidthTwips(structure: BracketStructure): number {
  const firstRoundMatchCount = structure.rounds.filter((m) => m.round === 1).length
  const maxRound = structure.rounds.reduce((max, m) => Math.max(max, m.round), 1)
  const isCompact = firstRoundMatchCount <= 2
  const layout = getOlympicLayout(isCompact)
  const slotHeightPx = getSlotHeightPx(firstRoundMatchCount, isCompact)
  const viewBox = getOlympicBracketViewBox(maxRound, firstRoundMatchCount, slotHeightPx, isCompact)
  // Rough px → twips at ~96dpi
  return Math.round(viewBox.width * 15)
}

function buildOlympicRoundGroups(maxRound: number, firstRoundMatchCount: number): Array<[number, number]> {
  if (maxRound <= 3 && firstRoundMatchCount <= 8) {
    return [[1, maxRound]]
  }
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

export function resolveCategoryPageLayout(category: BracketExportCategory): BracketCategoryPageLayout {
  const systemId = category.effectiveSystemId ?? category.structure.systemId
  const structure = category.structure

  if (systemId === 'champion' || systemId === 'three_way') {
    return { orientation: 'portrait' }
  }

  if (systemId === 'round_robin') {
    const count = category.participantCount
    if (count <= 5) {
      return { orientation: 'portrait' }
    }
    const matrixWidthTwips = count * MIN_READABLE_COLUMN_WIDTH_TWIPS
    if (matrixWidthTwips <= A4_PRINTABLE_WIDTH_PORTRAIT_TWIPS) {
      return { orientation: 'portrait' }
    }
    if (matrixWidthTwips <= A4_PRINTABLE_WIDTH_LANDSCAPE_TWIPS) {
      return { orientation: 'landscape' }
    }
    return { orientation: 'landscape', splitRoundRobinStandings: true }
  }

  if (systemId === 'olympic') {
    const firstRoundMatchCount = structure.rounds.filter((m) => m.round === 1).length
    const maxRound = structure.rounds.reduce((max, m) => Math.max(max, m.round), 1)
    const widthTwips = estimateOlympicWidthTwips(structure)
    const roundGroups = buildOlympicRoundGroups(maxRound, firstRoundMatchCount)

    if (maxRound <= 2 && widthTwips <= A4_PRINTABLE_WIDTH_PORTRAIT_TWIPS) {
      return { orientation: 'portrait', olympicRoundGroups: roundGroups }
    }
    if (widthTwips <= A4_PRINTABLE_WIDTH_LANDSCAPE_TWIPS && roundGroups.length === 1) {
      return { orientation: 'landscape', olympicRoundGroups: roundGroups }
    }
    return {
      orientation: 'landscape',
      olympicRoundGroups: roundGroups.length > 1 ? roundGroups : buildOlympicRoundGroups(maxRound, firstRoundMatchCount),
    }
  }

  return { orientation: 'portrait' }
}
