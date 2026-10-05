import type { BracketExportCategory } from '../../export/types'
import type { PrintPage } from '../types'
import { buildPageChrome } from '../formatCategoryMeta'
import { renderHeadToHeadSheet } from '../layoutEngine/sheets/headToHeadSheet'

export function buildHeadToHeadPage(category: BracketExportCategory): PrintPage {
  const rendered = renderHeadToHeadSheet(category)

  return {
    layoutKind: 'headToHead',
    orientation: 'portrait',
    viewBoxWidth: rendered.width,
    viewBoxHeight: rendered.height,
    svgDocument: rendered.svg,
    chrome: buildPageChrome({ category, pageIndex: 0, pageCount: 1 }),
    connectorPaths: [],
    matches: [],
    placements: [],
  }
}
