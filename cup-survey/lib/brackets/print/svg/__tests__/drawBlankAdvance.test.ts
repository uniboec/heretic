import { describe, expect, it } from 'vitest'
import { drawBlankAdvanceSvg } from '../drawBlankAdvance'

describe('drawBlankAdvanceSvg', () => {
  it('renders blank surname line above winner/loser hint', () => {
    const result = drawBlankAdvanceSvg({
      x: 10,
      y: 20,
      hintLabel: 'Победитель боя 2-12',
      lineX: 42,
      lineText: '________________________',
      ink: '#111111',
      muted: '#555555',
      fontFamily: 'Arial',
      nameFontSize: 13,
      hintFontSize: 9,
    })

    const lineIndex = result.svg.indexOf('________________________')
    const hintIndex = result.svg.indexOf('Победитель боя 2-12')
    expect(lineIndex).toBeGreaterThanOrEqual(0)
    expect(hintIndex).toBeGreaterThan(lineIndex)
  })
})
