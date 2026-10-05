function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function drawBlankAdvanceSvg(input: {
  x: number
  y: number
  hintLabel?: string
  lineX: number
  lineText: string
  ink: string
  muted: string
  fontFamily: string
  nameFontSize: number
  hintFontSize: number
}): { svg: string; height: number } {
  const hint = input.hintLabel?.trim()
  const lineY = input.y + 16
  const linePart = `<text x="${input.lineX}" y="${lineY}" font-family="${input.fontFamily}" font-size="${input.nameFontSize}" fill="${input.ink}">${input.lineText}</text>`
  const hintPart = hint
    ? `<text x="${input.x}" y="${lineY + 16}" font-family="${input.fontFamily}" font-size="${input.hintFontSize}" fill="${input.muted}">${escapeXml(hint)}</text>`
    : ''

  return {
    svg: `${linePart}\n${hintPart}`,
    height: hint ? 44 : 24,
  }
}
