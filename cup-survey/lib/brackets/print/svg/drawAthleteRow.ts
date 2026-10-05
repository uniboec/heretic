import type { PrintSlot } from '../types'
import { isAthleteSlot, isBlankSlot } from '../resolvePrintSlots'
import { drawBlankAdvanceSvg } from './drawBlankAdvance'
import {
  PAPER_BLANK_LINE,
  PRINT_COLOR_INK,
  PRINT_COLOR_MUTED,
  PRINT_FONT_FAMILY,
  PRINT_FONT_META,
  PRINT_FONT_NAME,
  PRINT_SCORE_BOX_HEIGHT,
  PRINT_SCORE_BOX_WIDTH,
} from '../printTheme'

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function drawAthleteRow(x: number, y: number, slot: PrintSlot, width: number): string {
  if (isBlankSlot(slot)) {
    return drawBlankAdvanceSvg({
      x,
      y,
      hintLabel: slot.hintLabel,
      lineX: x,
      lineText: PAPER_BLANK_LINE.slice(0, Math.floor(width / 8)),
      ink: PRINT_COLOR_INK,
      muted: PRINT_COLOR_MUTED,
      fontFamily: PRINT_FONT_FAMILY,
      nameFontSize: PRINT_FONT_NAME,
      hintFontSize: 9,
    }).svg
  }
  const seed = slot.seedPosition > 0 ? `[${slot.seedPosition}] ` : ''
  const meta = [slot.club, slot.city].filter(Boolean).join(', ')
  const nameLine = `${seed}${slot.name}`
  const scoreX = x + width - PRINT_SCORE_BOX_WIDTH
  const scoreText = slot.score ?? ''
  return `
    <text x="${x}" y="${y}" font-family="${PRINT_FONT_FAMILY}" font-size="${PRINT_FONT_NAME}" font-weight="700" fill="${PRINT_COLOR_INK}">${escapeXml(nameLine)}</text>
    ${meta ? `<text x="${x}" y="${y + 12}" font-family="${PRINT_FONT_FAMILY}" font-size="${PRINT_FONT_META}" fill="${PRINT_COLOR_MUTED}">${escapeXml(meta)}</text>` : ''}
    <rect x="${scoreX}" y="${y - 12}" width="${PRINT_SCORE_BOX_WIDTH}" height="${PRINT_SCORE_BOX_HEIGHT}" fill="none" stroke="${PRINT_COLOR_INK}" stroke-width="1"/>
    ${scoreText ? `<text x="${scoreX + 6}" y="${y}" font-family="${PRINT_FONT_FAMILY}" font-size="${PRINT_FONT_META}" fill="${PRINT_COLOR_INK}">${escapeXml(scoreText)}</text>` : ''}
  `
}

export function drawAdvanceLine(x: number, y: number, width: number): string {
  return `<text x="${x}" y="${y}" font-family="${PRINT_FONT_FAMILY}" font-size="${PRINT_FONT_NAME}" fill="${PRINT_COLOR_INK}">${PAPER_BLANK_LINE.slice(0, Math.floor(width / 8))}</text>`
}

export function drawAdvanceSlot(x: number, y: number, slot: PrintSlot, width: number): string {
  return drawAthleteRow(x, y, slot, width)
}
