import type { PrintPlacementRow } from '../types'
import { drawAdvanceSlot } from './drawAthleteRow'
import {
  PRINT_COLOR_INK,
  PRINT_FONT_FAMILY,
  PRINT_FONT_META,
} from '../printTheme'

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function drawPlacementColumn(
  x: number,
  startY: number,
  placements: PrintPlacementRow[],
): string {
  const lines: string[] = []
  let y = startY
  for (const row of placements) {
    lines.push(
      `<text x="${x}" y="${y}" font-family="${PRINT_FONT_FAMILY}" font-size="${PRINT_FONT_META}" font-weight="700" fill="${PRINT_COLOR_INK}">${row.placement} место</text>`,
    )
    lines.push(drawAdvanceSlot(x, y + 14, row.slot, 180))
    y += 44
  }
  return lines.join('\n')
}

export function drawChampionBlock(title: string, x: number, y: number, slotSvg: string): string {
  return `
    <text x="${x}" y="${y}" font-family="${PRINT_FONT_FAMILY}" font-size="14" font-weight="700" fill="${PRINT_COLOR_INK}">${escapeXml(title)}</text>
    ${slotSvg}
  `
}
