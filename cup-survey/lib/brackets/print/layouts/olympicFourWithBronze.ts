import type { BracketExportCategory } from '../../export/types'
import type { PrintPage } from '../types'
import { buildPageChrome } from '../formatCategoryMeta'
import { renderOlympicFourSheet } from '../layoutEngine/sheets/olympicFourSheet'

export function buildOlympicFourPage(category: BracketExportCategory): PrintPage {
  const rendered = renderOlympicFourSheet(category)

  return {
    layoutKind: 'olympicFour',
    orientation: 'landscape',
    viewBoxWidth: rendered.width,
    viewBoxHeight: rendered.height,
    svgDocument: rendered.svg,
    chrome: buildPageChrome({ category, pageIndex: 0, pageCount: 1, roundRangeLabel: 'Полуфиналы → Финал' }),
    connectorPaths: [],
    matches: [],
    placements: [],
    bronze: { mode: 'NONE' },
  }
}
