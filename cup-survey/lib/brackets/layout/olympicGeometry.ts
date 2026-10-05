/** Server-safe olympic bracket layout geometry — shared by web and Word renderers. */

export const BRACKET_MATCH_HEIGHT = 72
export const BRACKET_MIN_SLOT_HEIGHT = 88
export const BRACKET_CONNECTOR_WIDTH = 2.5

/** Flex weight for a match slot in round `round` (1-based). Doubles each round. */
export function getSlotFlexWeight(round: number): number {
  return 2 ** Math.max(0, round - 1)
}

export function getOlympicRoundLabel(round: number, maxRound: number, matchCount: number): string {
  if (round === maxRound && matchCount === 1) return 'Финал'

  const labels: Record<number, string> = {
    16: '1/16 финала',
    8: '1/8 финала',
    4: '1/4 финала',
    2: 'Полуфинал',
  }

  return labels[matchCount] ?? `Раунд ${round}`
}

/** @deprecated Absolute positioning — kept for tests only */
export const BRACKET_UNIT_GAP = 14

/** @deprecated Use flex layout instead */
export function getMatchTopPx(round: number, indexInRound: number): number {
  const unit = BRACKET_MATCH_HEIGHT + BRACKET_UNIT_GAP
  const multiplier = 2 ** (round - 1)
  return indexInRound * multiplier * 2 * unit + (multiplier * unit) / 2 - BRACKET_MATCH_HEIGHT / 2
}

/** @deprecated Use flex layout instead */
export function getOlympicColumnHeightPx(firstRoundMatchCount: number): number {
  if (firstRoundMatchCount <= 0) return BRACKET_MATCH_HEIGHT
  const unit = BRACKET_MATCH_HEIGHT + BRACKET_UNIT_GAP
  return firstRoundMatchCount * 2 * unit - BRACKET_UNIT_GAP
}

/** Layout constants — consumed by OlympicBracketTree as inline --olympic-* CSS variables. */
export const OLYMPIC_LAYOUT = {
  columnWidthPx: 272,
  connectorGapPx: 56,
  labelAreaPx: 40,
  baseSlotHeightPx: 112,
  matchCardGapPx: 12,
} as const

export const OLYMPIC_LAYOUT_COMPACT = {
  columnWidthPx: 256,
  connectorGapPx: 48,
  labelAreaPx: 48,
  baseSlotHeightPx: 112,
  matchCardGapPx: 14,
} as const

export const OLYMPIC_LAYOUT_MOBILE = {
  columnWidthPx: 240,
  connectorGapPx: 24,
  labelAreaPx: 36,
  baseSlotHeightPx: 76,
  matchCardGapPx: 6,
} as const

export type OlympicLayoutMode = {
  readonly columnWidthPx: number
  readonly connectorGapPx: number
  readonly labelAreaPx: number
  readonly baseSlotHeightPx: number
  readonly matchCardGapPx: number
}

export interface OlympicLayoutOptions {
  isMobile?: boolean
  viewportWidth?: number
}

function getMobileColumnWidth(viewportWidth: number): number {
  return Math.min(240, Math.max(200, Math.round(viewportWidth * 0.82)))
}

export function getOlympicLayout(isCompact: boolean, options?: OlympicLayoutOptions): OlympicLayoutMode {
  if (options?.isMobile) {
    return {
      ...OLYMPIC_LAYOUT_MOBILE,
      columnWidthPx: getMobileColumnWidth(options.viewportWidth ?? 390),
    }
  }
  return isCompact ? OLYMPIC_LAYOUT_COMPACT : OLYMPIC_LAYOUT
}

export function getSlotHeightPx(
  firstRoundMatchCount: number,
  isCompact = false,
  options?: OlympicLayoutOptions,
): number {
  const layout = getOlympicLayout(isCompact, options)
  const useCompactHeights = isCompact || options?.isMobile
  const extra = useCompactHeights ? 0 : Math.max(0, firstRoundMatchCount - 2) * 10
  const slotGap = useCompactHeights ? layout.matchCardGapPx : 0
  return layout.baseSlotHeightPx + extra + slotGap
}

export function getMatchCenterY(
  round: number,
  indexInRound: number,
  firstRoundMatchCount: number,
  slotHeightPx: number,
): number {
  const slotWeight = 2 ** (round - 1)
  const centerSlot = (indexInRound * slotWeight + slotWeight / 2) / firstRoundMatchCount
  return centerSlot * firstRoundMatchCount * slotHeightPx
}

export function buildOlympicConnectorPaths(
  maxRound: number,
  firstRoundMatchCount: number,
  slotHeightPx: number,
  isCompact = false,
  layoutOptions?: OlympicLayoutOptions,
): string[] {
  const { columnWidthPx, connectorGapPx, labelAreaPx } = getOlympicLayout(isCompact, layoutOptions)
  const paths: string[] = []

  const colRightX = (round: number) => (round - 1) * (columnWidthPx + connectorGapPx) + columnWidthPx
  const colLeftX = (round: number) => (round - 1) * (columnWidthPx + connectorGapPx)
  const junctionX = (round: number) => colRightX(round) + connectorGapPx / 2

  const yAt = (round: number, index: number) =>
    labelAreaPx + getMatchCenterY(round, index, firstRoundMatchCount, slotHeightPx)

  for (let round = 1; round < maxRound; round++) {
    const matchesInRound = firstRoundMatchCount / 2 ** (round - 1)

    for (let i = 0; i < matchesInRound; i += 2) {
      const yTop = yAt(round, i)
      const yBottom = yAt(round, i + 1)
      const yMid = (yTop + yBottom) / 2
      const nextIndex = i / 2
      const yNext = yAt(round + 1, nextIndex)

      const xOut = colRightX(round)
      const xJunc = junctionX(round)
      const xNextIn = colLeftX(round + 1)

      paths.push(`M ${xOut} ${yTop} H ${xJunc}`)
      paths.push(`M ${xOut} ${yBottom} H ${xJunc}`)
      paths.push(`M ${xJunc} ${yTop} V ${yBottom}`)
      paths.push(`M ${xJunc} ${yMid} H ${xNextIn}`)
      if (Math.abs(yNext - yMid) > 0.5) {
        paths.push(`M ${xNextIn} ${yMid} V ${yNext}`)
      }
    }
  }

  return paths
}

export function getOlympicBracketViewBox(
  maxRound: number,
  firstRoundMatchCount: number,
  slotHeightPx: number,
  isCompact = false,
  layoutOptions?: OlympicLayoutOptions,
): { width: number; height: number } {
  const { columnWidthPx, connectorGapPx, labelAreaPx } = getOlympicLayout(isCompact, layoutOptions)
  return {
    width: maxRound * columnWidthPx + (maxRound - 1) * connectorGapPx,
    height: labelAreaPx + firstRoundMatchCount * slotHeightPx,
  }
}

/** Total grid rows for olympic bracket table. */
export function getOlympicTableRowCount(firstRoundMatchCount: number): number {
  return Math.max(2, firstRoundMatchCount * 2)
}

/** Layout of one match cell in the olympic table grid. */
export function getOlympicMatchLayout(
  round: number,
  slot: number,
  firstRoundMatchCount: number,
): { startRow: number; rowSpan: number } {
  const totalRows = getOlympicTableRowCount(firstRoundMatchCount)
  const matchesInRound = firstRoundMatchCount / 2 ** (round - 1)
  const rowSpan = totalRows / matchesInRound
  const startRow = (slot - 1) * rowSpan
  return { startRow, rowSpan }
}

/** @deprecated Use getOlympicMatchLayout */
export function getOlympicMatchRowSpan(round: number): number {
  return getSlotFlexWeight(round)
}

/** @deprecated Use getOlympicMatchLayout */
export function getOlympicMatchStartRow(round: number, slot: number, firstRoundMatchCount: number): number {
  return getOlympicMatchLayout(round, slot, firstRoundMatchCount).startRow
}
