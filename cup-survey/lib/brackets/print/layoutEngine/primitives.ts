import type { PrintSlot } from '../types'
import { isAthleteSlot, isBlankSlot } from '../resolvePrintSlots'
import { drawBlankAdvanceSvg } from '../svg/drawBlankAdvance'
import {
  LAYOUT,
  escapeXml,
  handwritingLine,
  type Rect,
  wrapNameLines,
} from './metrics'

const INK = '#111111'
const MUTED = '#555555'
const FONT = 'Arial, Helvetica, sans-serif'

export type AthleteDrawResult = {
  svg: string
  rect: Rect
  rightAnchor: { x: number; y: number }
  leftAnchor: { x: number; y: number }
}

export function drawAthleteBlock(
  x: number,
  y: number,
  slot: PrintSlot,
  options?: { showScoreBox?: boolean; nameMaxWidth?: number },
): AthleteDrawResult {
  const showScoreBox = options?.showScoreBox ?? true
  const nameMaxWidth = options?.nameMaxWidth ?? 240

  if (isBlankSlot(slot)) {
    const blank = drawBlankAdvanceSvg({
      x,
      y,
      hintLabel: slot.hintLabel,
      lineX: x + LAYOUT.seedColumnWidth,
      lineText: handwritingLine(LAYOUT.advanceLineChars),
      ink: INK,
      muted: MUTED,
      fontFamily: FONT,
      nameFontSize: LAYOUT.nameFontSize,
      hintFontSize: 9,
    })
    const blockHeight = Math.max(LAYOUT.athleteRowMinHeight, blank.height)
    const anchorY = y + blockHeight / 2
    return {
      svg: blank.svg,
      rect: {
        x,
        y,
        width: nameMaxWidth + LAYOUT.seedColumnWidth + (showScoreBox ? LAYOUT.scoreBoxWidth + 8 : 0),
        height: blockHeight,
      },
      rightAnchor: { x: x + LAYOUT.seedColumnWidth + nameMaxWidth, y: anchorY },
      leftAnchor: { x, y: anchorY },
    }
  }

  const seed = slot.seedPosition > 0 ? `[${slot.seedPosition}]` : ''
  const nameLines = wrapNameLines(slot.name)
  const meta = [slot.club, slot.city].filter(Boolean).join(' · ')
  const scoreX = x + LAYOUT.seedColumnWidth + nameMaxWidth + 8
  const lineHeight = 16
  let textY = y + 14
  const textParts: string[] = []

  if (seed) {
    textParts.push(
      `<text x="${x}" y="${textY}" font-family="${FONT}" font-size="${LAYOUT.metaFontSize}" font-weight="700" fill="${INK}">${escapeXml(seed)}</text>`,
    )
  }

  for (const line of nameLines) {
    textParts.push(
      `<text x="${x + LAYOUT.seedColumnWidth}" y="${textY}" font-family="${FONT}" font-size="${LAYOUT.nameFontSize}" font-weight="700" fill="${INK}">${escapeXml(line)}</text>`,
    )
    textY += lineHeight
  }

  if (meta) {
    textParts.push(
      `<text x="${x + LAYOUT.seedColumnWidth}" y="${textY}" font-family="${FONT}" font-size="${LAYOUT.metaFontSize}" fill="${MUTED}">${escapeXml(meta)}</text>`,
    )
    textY += lineHeight
  }

  const blockHeight = Math.max(LAYOUT.athleteRowMinHeight, textY - y + 4)
  const scoreY = y + blockHeight / 2

  if (showScoreBox) {
    textParts.push(
      `<rect x="${scoreX}" y="${scoreY - LAYOUT.scoreBoxHeight / 2}" width="${LAYOUT.scoreBoxWidth}" height="${LAYOUT.scoreBoxHeight}" fill="none" stroke="${INK}" stroke-width="1.5"/>`,
    )
    if (slot.score) {
      textParts.push(
        `<text x="${scoreX + 8}" y="${scoreY + 5}" font-family="${FONT}" font-size="${LAYOUT.metaFontSize}" fill="${INK}">${escapeXml(slot.score)}</text>`,
      )
    }
  }

  const totalWidth = showScoreBox
    ? scoreX + LAYOUT.scoreBoxWidth - x
    : LAYOUT.seedColumnWidth + nameMaxWidth

  return {
    svg: textParts.join('\n'),
    rect: { x, y, width: totalWidth, height: blockHeight },
    rightAnchor: { x: x + totalWidth, y: y + blockHeight / 2 },
    leftAnchor: { x, y: y + blockHeight / 2 },
  }
}

export function drawBoutBadge(centerX: number, y: number, label: string): { svg: string; rect: Rect } {
  const textWidth = label.length * 7 + LAYOUT.badgePaddingX * 2
  const x = centerX - textWidth / 2
  const svg = `
    <rect x="${x}" y="${y}" width="${textWidth}" height="${LAYOUT.badgeHeight}" fill="#EEEEEE" stroke="#999999" stroke-width="1"/>
    <text x="${centerX}" y="${y + 14}" text-anchor="middle" font-family="${FONT}" font-size="${LAYOUT.badgeFontSize}" font-weight="700" fill="${INK}">${label}</text>
  `
  return { svg, rect: { x, y, width: textWidth, height: LAYOUT.badgeHeight } }
}

export type MatchDrawResult = {
  svg: string
  rect: Rect
  badgeCenter: { x: number; y: number }
  winnerAnchor: { x: number; y: number }
  topAthleteAnchor: { x: number; y: number }
  bottomAthleteAnchor: { x: number; y: number }
  topAthleteLeft: { x: number; y: number }
  bottomAthleteLeft: { x: number; y: number }
}

export function drawMatchPair(
  x: number,
  y: number,
  slotA: PrintSlot,
  slotB: PrintSlot,
  boutBadgeLabel: string | null,
  nameMaxWidth = 240,
): MatchDrawResult {
  const top = drawAthleteBlock(x, y, slotA, { nameMaxWidth })
  const bottomY = y + top.rect.height + LAYOUT.matchAthleteGap
  const bottom = drawAthleteBlock(x, bottomY, slotB, { nameMaxWidth })
  const matchHeight = bottomY + bottom.rect.height - y
  const centerX = x + Math.max(top.rect.width, bottom.rect.width) / 2
  const badgeY = y + top.rect.height + LAYOUT.matchAthleteGap / 2 - LAYOUT.badgeHeight / 2

  const parts = [top.svg, bottom.svg]
  if (boutBadgeLabel) {
    parts.push(drawBoutBadge(centerX, badgeY, boutBadgeLabel).svg)
  }

  const rightX = Math.max(top.rightAnchor.x, bottom.rightAnchor.x)
  return {
    svg: parts.join('\n'),
    rect: { x, y, width: rightX - x + 8, height: matchHeight },
    badgeCenter: { x: centerX, y: badgeY + LAYOUT.badgeHeight / 2 },
    winnerAnchor: { x: rightX, y: y + matchHeight / 2 },
    topAthleteAnchor: top.rightAnchor,
    bottomAthleteAnchor: bottom.rightAnchor,
    topAthleteLeft: top.leftAnchor,
    bottomAthleteLeft: bottom.leftAnchor,
  }
}

export function drawSectionLabel(x: number, y: number, label: string): string {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${LAYOUT.sectionFontSize}" font-weight="700" fill="${INK}">${escapeXml(label)}</text>`
}

export function drawConnectorPath(d: string, strokeWidth = 2): string {
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${strokeWidth}" stroke-linecap="square"/>`
}

export function drawPlacementOutcome(
  x: number,
  y: number,
  placement: 1 | 2 | 3,
  slot: PrintSlot,
): { svg: string; rect: Rect; lineStart: { x: number; y: number } } {
  const label = `${placement} место`
  const lineY = y + 28
  const lineX = x + 86
  const namePart = isAthleteSlot(slot)
    ? `<text x="${lineX}" y="${lineY}" font-family="${FONT}" font-size="${LAYOUT.nameFontSize}" font-weight="700" fill="${INK}">${escapeXml(slot.name)}</text>`
    : `<text x="${lineX}" y="${lineY}" font-family="${FONT}" font-size="${LAYOUT.nameFontSize}" fill="${INK}">${handwritingLine(LAYOUT.placementLineChars)}</text>`

  const svg = `
    <text x="${x}" y="${y + 14}" font-family="${FONT}" font-size="${LAYOUT.metaFontSize}" font-weight="700" fill="${INK}">${label}</text>
    ${namePart}
  `
  return {
    svg,
    rect: { x, y, width: 320, height: 40 },
    lineStart: { x: lineX, y: lineY },
  }
}

export function drawHintLabel(x: number, y: number, text: string): string {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="9" fill="${MUTED}">${escapeXml(text)}</text>`
}
