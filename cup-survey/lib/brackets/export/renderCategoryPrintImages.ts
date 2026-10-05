import 'server-only'

import type { BracketExportCategory } from './types'
import { buildBracketPrintModel } from '../print/buildBracketPrintModel'
import { renderBracketSvg } from '../print/renderBracketSvg'
import { rasterizeSvg } from '../print/rasterizeSvg'

export type CategoryPrintImage = {
  png: Buffer
  viewBoxWidth: number
  viewBoxHeight: number
  orientation: 'portrait' | 'landscape'
}

export async function renderCategoryPrintImages(
  category: BracketExportCategory,
): Promise<CategoryPrintImage[]> {
  const model = buildBracketPrintModel(category)
  const images: CategoryPrintImage[] = []

  for (const page of model.pages) {
    const svg = renderBracketSvg(page)
    const png = await rasterizeSvg(svg, page.viewBoxWidth, page.viewBoxHeight)
    images.push({
      png,
      viewBoxWidth: page.viewBoxWidth,
      viewBoxHeight: page.viewBoxHeight,
      orientation: page.orientation,
    })
  }

  return images
}
