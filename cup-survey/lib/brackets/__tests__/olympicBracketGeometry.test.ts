import { describe, expect, it } from 'vitest'
import {
  buildBracketGeometryStyle,
  buildOlympicConnectorPaths,
  getMatchCenterY,
  getOlympicLayout,
  getSlotHeightPx,
} from '../../../components/tournament/brackets/systems/olympic/olympicBracketGeometry'

describe('olympicBracketGeometry', () => {
  it('increases slot height for larger first rounds', () => {
    expect(getSlotHeightPx(2)).toBeLessThan(getSlotHeightPx(8))
  })

  it('uses compact mobile slot height', () => {
    const mobileTwo = getSlotHeightPx(2, false, { isMobile: true, viewportWidth: 390 })
    const mobileEight = getSlotHeightPx(8, false, { isMobile: true, viewportWidth: 390 })
    expect(mobileTwo).toBe(82)
    expect(mobileEight).toBe(82)
  })

  it('aligns feeder pair midpoint with next-round match center', () => {
    const firstRoundMatchCount = 4
    const slotH = getSlotHeightPx(firstRoundMatchCount)
    const y0 = getMatchCenterY(1, 0, firstRoundMatchCount, slotH)
    const y1 = getMatchCenterY(1, 1, firstRoundMatchCount, slotH)
    const yNext = getMatchCenterY(2, 0, firstRoundMatchCount, slotH)
    expect((y0 + y1) / 2).toBeCloseTo(yNext, 5)
  })

  it('uses compact layout for four-athlete brackets', () => {
    const layout = getOlympicLayout(true)
    expect(layout.columnWidthPx).toBe(256)
    expect(getSlotHeightPx(2, true)).toBe(126)
  })

  it('builds fork paths for each feeder pair', () => {
    const paths = buildOlympicConnectorPaths(3, 4, getSlotHeightPx(4))
    expect(paths.length).toBe(12)
  })
})
