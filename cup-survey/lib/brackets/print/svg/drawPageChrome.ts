import type { PrintPageChrome } from '../types'
import { pageHeaderLabel } from '../formatCategoryMeta'
import {
  PRINT_COLOR_INK,
  PRINT_COLOR_MUTED,
  PRINT_FONT_FAMILY,
  PRINT_FONT_META,
} from '../printTheme'

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function drawPageChrome(chrome: PrintPageChrome, width: number): string {
  const parts: string[] = []

  const header = pageHeaderLabel(chrome.pageIndex, chrome.pageCount)
  if (header) {
    parts.push(
      `<text x="${width - 40}" y="28" text-anchor="end" font-family="${PRINT_FONT_FAMILY}" font-size="${PRINT_FONT_META}" fill="${PRINT_COLOR_INK}">${escapeXml(header)}</text>`,
    )
  }

  if (chrome.roundRangeLabel) {
    parts.push(
      `<text x="40" y="58" font-family="${PRINT_FONT_FAMILY}" font-size="${PRINT_FONT_META}" font-weight="700" fill="${PRINT_COLOR_INK}">${escapeXml(chrome.roundRangeLabel)}</text>`,
    )
  }

  if (chrome.continuationBanner) {
    parts.push(
      `<text x="40" y="${chrome.pageIndex === 0 ? 74 : 58}" font-family="${PRINT_FONT_FAMILY}" font-size="${PRINT_FONT_META}" fill="${PRINT_COLOR_MUTED}">${escapeXml(chrome.continuationBanner)}</text>`,
    )
  }

  for (const anchor of chrome.outgoingAnchors) {
    parts.push(
      `<text x="${anchor.x}" y="${anchor.y}" font-family="${PRINT_FONT_FAMILY}" font-size="${PRINT_FONT_META}" font-weight="700" fill="${PRINT_COLOR_INK}">[${escapeXml(anchor.label)}] →</text>`,
    )
  }

  for (const anchor of chrome.incomingAnchors) {
    parts.push(
      `<text x="${anchor.x}" y="${anchor.y}" font-family="${PRINT_FONT_FAMILY}" font-size="${PRINT_FONT_META}" font-weight="700" fill="${PRINT_COLOR_INK}">← [${escapeXml(anchor.label)}]</text>`,
    )
  }

  return parts.join('\n')
}
