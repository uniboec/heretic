/** Layout metrics for judge sheets — all values in SVG px units. */

export const LAYOUT = {
  padding: 36,
  /** Minimum height of one athlete block */
  athleteRowMinHeight: 56,
  /** Gap between two athletes in a match */
  matchAthleteGap: 82,
  /** Gap between semifinal rows */
  matchVerticalGap: 48,
  /** Horizontal gap between bracket columns */
  roundGap: 200,
  scoreBoxWidth: 54,
  scoreBoxHeight: 22,
  seedColumnWidth: 32,
  nameFontSize: 13,
  metaFontSize: 10,
  sectionFontSize: 11,
  badgeFontSize: 10,
  badgeHeight: 20,
  badgePaddingX: 10,
  advanceLineChars: 28,
  placementLineChars: 32,
  /** Target content width for compact sheets (landscape olympic 4) */
  targetLandscapeWidth: 920,
  targetLandscapeHeight: 520,
  /** Target for portrait sheets (head-to-head, three-way) */
  targetPortraitWidth: 640,
  targetPortraitHeight: 780,
} as const

export const PRINTABLE_DOCX = {
  landscape: { width: 960, height: 680 },
  portrait: { width: 680, height: 920 },
} as const

export type Rect = { x: number; y: number; width: number; height: number }

export function unionBounds(rects: Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 1, height: 1 }
  const x1 = Math.min(...rects.map((r) => r.x))
  const y1 = Math.min(...rects.map((r) => r.y))
  const x2 = Math.max(...rects.map((r) => r.x + r.width))
  const y2 = Math.max(...rects.map((r) => r.y + r.height))
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function wrapNameLines(name: string, maxLineChars = 26): string[] {
  const words = name.trim().split(/\s+/)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxLineChars) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word.length > maxLineChars ? word.slice(0, maxLineChars) : word
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 2)
}

export function handwritingLine(charCount: number): string {
  return '_'.repeat(Math.max(8, charCount))
}

export function finalizeSvg(parts: string[], bounds: Rect, padding = LAYOUT.padding): {
  svg: string
  width: number
  height: number
} {
  const width = bounds.width + padding * 2
  const height = bounds.height + padding * 2
  const offsetX = padding - bounds.x
  const offsetY = padding - bounds.y
  const inner = parts.join('\n')
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <g transform="translate(${offsetX}, ${offsetY})">
  ${inner}
  </g>
</svg>`
  return { svg, width, height }
}
