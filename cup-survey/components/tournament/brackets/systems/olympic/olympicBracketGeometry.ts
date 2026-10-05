import type { CSSProperties } from 'react'
import {
  type OlympicLayoutMode,
  type OlympicLayoutOptions,
  buildOlympicConnectorPaths,
  getMatchCenterY,
  getOlympicBracketViewBox,
  getOlympicLayout,
  getSlotHeightPx,
} from '@/lib/brackets/layout/olympicGeometry'

export type { OlympicLayoutMode, OlympicLayoutOptions }

export {
  OLYMPIC_LAYOUT,
  OLYMPIC_LAYOUT_COMPACT,
  OLYMPIC_LAYOUT_MOBILE,
  buildOlympicConnectorPaths,
  getMatchCenterY,
  getOlympicBracketViewBox,
  getOlympicLayout,
  getSlotHeightPx,
} from '@/lib/brackets/layout/olympicGeometry'

export function buildBracketGeometryStyle(
  layout: OlympicLayoutMode,
  firstRoundMatchCount: number,
  slotHeightPx: number,
): CSSProperties {
  return {
    '--olympic-first-round-matches': String(firstRoundMatchCount),
    '--olympic-min-slot-height': `${slotHeightPx}px`,
    '--olympic-column-width': `${layout.columnWidthPx}px`,
    '--olympic-connector-gap': `${layout.connectorGapPx}px`,
    '--olympic-label-area': `${layout.labelAreaPx}px`,
  } as CSSProperties
}
