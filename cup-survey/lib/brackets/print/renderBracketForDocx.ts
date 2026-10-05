import 'server-only'

import { Paragraph, PageBreak } from 'docx'
import type { FileChild } from 'docx'
import type { BracketExportCategory } from '../export/types'
import { buildBracketPrintModel } from './buildBracketPrintModel'
import { renderBracketSvg } from './renderBracketSvg'
import { rasterizeSvg } from './rasterizeSvg'
import { centeredBracketImageParagraph, textParagraph } from '../export/docxNodes'
import { PRINTABLE_DOCX } from './layoutEngine/metrics'

function categoryHeaderParagraphs(category: BracketExportCategory): Paragraph[] {
  const meta = [
    category.discipline,
    category.matIndex != null ? `Ковёр ${category.matIndex}` : null,
    `Этап ${category.competitionStage}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return [
    textParagraph(category.title, { bold: true, size: 32, spacingAfter: 80 }),
    textParagraph(meta, { spacingAfter: 160 }),
  ]
}

export async function renderCategoryPrintPages(category: BracketExportCategory): Promise<FileChild[]> {
  const model = buildBracketPrintModel(category)
  const nodes: FileChild[] = []

  for (let i = 0; i < model.pages.length; i++) {
    const page = model.pages[i]!
    nodes.push(...categoryHeaderParagraphs(category))

    const svg = renderBracketSvg(page)
    const png = await rasterizeSvg(svg, page.viewBoxWidth, page.viewBoxHeight)
    const printable = PRINTABLE_DOCX[page.orientation]
    const aspect = page.viewBoxHeight / page.viewBoxWidth
    let displayWidth = printable.width
    let displayHeight = Math.round(displayWidth * aspect)
    if (displayHeight > printable.height) {
      displayHeight = printable.height
      displayWidth = Math.round(displayHeight / aspect)
    }

    nodes.push(
      centeredBracketImageParagraph(png, {
        width: displayWidth,
        height: displayHeight,
      }),
    )

    if (i < model.pages.length - 1) {
      nodes.push(new Paragraph({ children: [new PageBreak()] }))
    }
  }

  return nodes
}

export async function countCategoryImageRuns(category: BracketExportCategory): Promise<number> {
  return buildBracketPrintModel(category).pages.length
}
