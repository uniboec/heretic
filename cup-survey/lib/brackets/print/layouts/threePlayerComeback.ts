import type { BracketExportCategory } from '../../export/types'
import type { PrintPage } from '../types'
import { buildPageChrome } from '../formatCategoryMeta'
import { renderThreeWaySheet } from '../layoutEngine/sheets/threeWaySheet'

export function buildThreePlayerComebackPage(category: BracketExportCategory): PrintPage {
  const rendered = renderThreeWaySheet(category)

  return {
    layoutKind: 'threeWay',
    orientation: 'portrait',
    viewBoxWidth: rendered.width,
    viewBoxHeight: rendered.height,
    svgDocument: rendered.svg,
    chrome: buildPageChrome({ category, pageIndex: 0, pageCount: 1, roundRangeLabel: 'Тройка с возвратом' }),
    connectorPaths: [],
    matches: [],
    placements: [],
    bronze: { mode: 'NONE' },
  }
}
