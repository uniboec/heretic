import type { OlympicBronzeMode } from '../core/types'
import type { BracketExportCategory } from '../export/types'

export type PrintSlot =
  | {
      kind: 'ATHLETE'
      entryId: string
      seedPosition: number
      name: string
      club?: string
      city?: string
      score?: string | null
    }
  | {
      kind: 'BLANK_ADVANCE'
      sourceBoutId: string
      sourceOutcome: 'WINNER' | 'LOSER'
      hintLabel?: string
    }

export type PrintPlacementRow = {
  placement: 1 | 2 | 3
  slot: PrintSlot
}

export type PrintMatchNode = {
  id: string
  boutNumber: number | null
  boutBadgeLabel?: string | null
  roundLabel?: string
  slotA: PrintSlot
  slotB: PrintSlot
  /** Winner advance to next stage (blank line or athlete name on connector) */
  advanceWinner?: PrintSlot
  x: number
  y: number
  width: number
  height: number
}

export type PrintBronzeSection =
  | { mode: 'NONE' }
  | { mode: 'ONE'; match: PrintMatchNode }
  | { mode: 'TWO'; slotA: PrintSlot; slotB: PrintSlot; y: number }

export type PrintAnchor = {
  label: string
  slot: PrintSlot
  x: number
  y: number
  side: 'left' | 'right'
}

export type PrintPageChrome = {
  pageIndex: number
  pageCount: number
  categoryTitle: string
  metaLine: string
  roundRangeLabel?: string
  continuationBanner?: string
  incomingAnchors: PrintAnchor[]
  outgoingAnchors: PrintAnchor[]
}

export type RoundRobinCell = {
  rowEntryId: string
  colEntryId: string
  boutNumber: number | null
  boutLabel: string | null
  score: string | null
  finished: boolean
}

export type RoundRobinPrintData = {
  participants: Array<{ entryId: string; seedPosition: number; name: string; club?: string }>
  matrix: RoundRobinCell[][]
  standings: Array<{ entryId: string; wins: number; losses: number; rank: number }>
}

export type PrintLayoutKind =
  | 'champion'
  | 'headToHead'
  | 'olympicFour'
  | 'threeWay'
  | 'olympicTree'
  | 'roundRobin'

export type PrintPage = {
  layoutKind: PrintLayoutKind
  orientation: 'portrait' | 'landscape'
  viewBoxWidth: number
  viewBoxHeight: number
  /** Content-driven SVG; when set, renderBracketSvg returns this directly. */
  svgDocument?: string
  chrome: PrintPageChrome
  connectorPaths: string[]
  matches: PrintMatchNode[]
  placements: PrintPlacementRow[]
  bronze?: PrintBronzeSection
  roundRobin?: RoundRobinPrintData
}

export type PrintModel = {
  categoryKey: string
  title: string
  metaLine: string
  systemId: string
  effectiveBronzeMode: OlympicBronzeMode | null
  orientation: 'portrait' | 'landscape'
  pages: PrintPage[]
}

export type PrintBuildContext = {
  category: BracketExportCategory
  effectiveBronzeMode: OlympicBronzeMode | null
}

export type { BracketExportCategory }
