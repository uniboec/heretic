import type { BracketExportCategory } from '../../export/types'
import type { PrintPage } from '../types'
import { buildPageChrome } from '../formatCategoryMeta'
import { renderChampionSheetLayout } from '../layoutEngine/sheets/championSheetLayout'

export function buildChampionSheetPage(category: BracketExportCategory): PrintPage {
  const rendered = renderChampionSheetLayout(category)

  return {
    layoutKind: 'champion',
    orientation: 'portrait',
    viewBoxWidth: rendered.width,
    viewBoxHeight: rendered.height,
    svgDocument: rendered.svg,
    chrome: buildPageChrome({ category, pageIndex: 0, pageCount: 1 }),
    connectorPaths: [],
    matches: [],
    placements: [],
    roundRobin: undefined,
  }
}
