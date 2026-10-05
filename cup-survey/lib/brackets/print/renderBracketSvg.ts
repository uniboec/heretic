import type { PrintBronzeSection, PrintMatchNode, PrintPage } from './types'
import { drawAthleteRow, drawAdvanceSlot } from './svg/drawAthleteRow'
import { drawChampionBlock, drawPlacementColumn } from './svg/drawPlacementColumn'
import { drawPageChrome } from './svg/drawPageChrome'
import {
  PRINT_COLOR_BADGE_BG,
  PRINT_COLOR_BADGE_BORDER,
  PRINT_COLOR_INK,
  PRINT_FONT_FAMILY,
  PRINT_FONT_META,
  PRINT_LINE_MAIN,
  PRINT_MATCH_ROW_HEIGHT,
} from './printTheme'

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function drawMatch(node: PrintMatchNode): string {
  const parts: string[] = []
  if (node.roundLabel) {
    parts.push(
      `<text x="${node.x}" y="${node.y - 8}" font-family="${PRINT_FONT_FAMILY}" font-size="${PRINT_FONT_META}" font-weight="700" fill="${PRINT_COLOR_INK}">${escapeXml(node.roundLabel)}</text>`,
    )
  }
  const badge = node.boutBadgeLabel ?? (node.boutNumber != null ? `Бой №${node.boutNumber}` : null)
  if (badge) {
    parts.push(
      `<rect x="${node.x + node.width / 2 - 36}" y="${node.y + PRINT_MATCH_ROW_HEIGHT}" width="72" height="16" fill="${PRINT_COLOR_BADGE_BG}" stroke="${PRINT_COLOR_BADGE_BORDER}" stroke-width="1"/>`,
      `<text x="${node.x + node.width / 2}" y="${node.y + PRINT_MATCH_ROW_HEIGHT + 12}" text-anchor="middle" font-family="${PRINT_FONT_FAMILY}" font-size="${PRINT_FONT_META}" font-weight="700" fill="${PRINT_COLOR_INK}">${badge}</text>`,
    )
  }
  parts.push(drawAthleteRow(node.x, node.y + 4, node.slotA, node.width))
  parts.push(drawAthleteRow(node.x, node.y + PRINT_MATCH_ROW_HEIGHT + 8, node.slotB, node.width))
  if (node.advanceWinner) {
    parts.push(
      drawAdvanceSlot(node.x + node.width + 8, node.y + PRINT_MATCH_ROW_HEIGHT, node.advanceWinner, 140),
    )
  }
  return parts.join('\n')
}

function drawBronze(bronze: PrintBronzeSection, placementX: number): string {
  if (bronze.mode === 'NONE') return ''
  if (bronze.mode === 'ONE') {
    return drawMatch(bronze.match)
  }
  const y = bronze.y
  return `
    <text x="40" y="${y}" font-family="${PRINT_FONT_FAMILY}" font-size="${PRINT_FONT_META}" font-weight="700" fill="${PRINT_COLOR_INK}">БРОНЗА</text>
    ${drawAdvanceSlot(40, y + 20, bronze.slotA, 200)}
    ${drawAdvanceSlot(40, y + 48, bronze.slotB, 200)}
    ${drawPlacementColumn(placementX, y + 20, [{ placement: 3, slot: bronze.slotA }])}
  `
}

function drawRoundRobin(page: PrintPage): string {
  const rr = page.roundRobin
  if (!rr) return ''
  const cell = 36
  const startX = 40
  const startY = 120
  const parts: string[] = []

  parts.push(
    `<text x="${startX}" y="${startY - 16}" font-family="${PRINT_FONT_FAMILY}" font-size="${PRINT_FONT_META}" font-weight="700" fill="${PRINT_COLOR_INK}">Матрица поединков</text>`,
  )

  for (let c = 0; c < rr.participants.length; c++) {
    const p = rr.participants[c]!
    parts.push(
      `<text x="${startX + (c + 1) * cell + 8}" y="${startY}" font-family="${PRINT_FONT_FAMILY}" font-size="8" fill="${PRINT_COLOR_INK}">[${p.seedPosition}]</text>`,
    )
  }

  for (let r = 0; r < rr.participants.length; r++) {
    const row = rr.participants[r]!
    parts.push(
      `<text x="${startX}" y="${startY + (r + 1) * cell + 4}" font-family="${PRINT_FONT_FAMILY}" font-size="8" fill="${PRINT_COLOR_INK}">${escapeXml(row.name.slice(0, 12))}</text>`,
    )
    for (let c = 0; c < rr.participants.length; c++) {
      const cellData = rr.matrix[r]?.[c]
      const x = startX + (c + 1) * cell
      const y = startY + r * cell
      const text =
        r === c
          ? String(row.seedPosition)
          : cellData?.score ?? (cellData?.boutLabel ? `Б${cellData.boutLabel}` : '')
      parts.push(
        `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="none" stroke="${PRINT_COLOR_BADGE_BORDER}" stroke-width="1"/>`,
        `<text x="${x + cell / 2}" y="${y + cell / 2 + 4}" text-anchor="middle" font-family="${PRINT_FONT_FAMILY}" font-size="8" fill="${PRINT_COLOR_INK}">${escapeXml(String(text))}</text>`,
      )
    }
  }

  return parts.join('\n')
}

export function renderBracketSvg(page: PrintPage): string {
  if (page.svgDocument) {
    return page.svgDocument
  }

  const { viewBoxWidth, viewBoxHeight } = page
  const placementX = viewBoxWidth - 220
  const placementY = 120

  const paths = page.connectorPaths
    .map((d) => `<path d="${d}" fill="none" stroke="${PRINT_COLOR_INK}" stroke-width="${PRINT_LINE_MAIN}"/>`)
    .join('\n')

  const matches = page.matches.map(drawMatch).join('\n')
  const bronze = page.bronze ? drawBronze(page.bronze, placementX) : ''
  const placements =
    page.layoutKind === 'champion'
      ? drawChampionBlock(
          'ПОБЕДИТЕЛЬ КАТЕГОРИИ',
          80,
          140,
          drawAdvanceSlot(80, 170, page.placements[0]?.slot ?? { kind: 'BLANK_ADVANCE', sourceBoutId: 'p1', sourceOutcome: 'WINNER' }, 300),
        )
      : drawPlacementColumn(placementX, placementY, page.placements)

  const roundRobin = page.layoutKind === 'roundRobin' ? drawRoundRobin(page) : ''
  const chrome = drawPageChrome(page.chrome, viewBoxWidth)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${viewBoxWidth}" height="${viewBoxHeight}" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  ${chrome}
  ${paths}
  ${matches}
  ${bronze}
  ${placements}
  ${roundRobin}
</svg>`
}
