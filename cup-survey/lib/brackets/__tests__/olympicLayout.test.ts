import { describe, expect, it } from 'vitest'
import {
  getOlympicRoundLabel,
  getSlotFlexWeight,
} from '../../../components/tournament/brackets/olympicLayout'

describe('getOlympicRoundLabel', () => {
  it('labels N=4 bracket correctly', () => {
    expect(getOlympicRoundLabel(1, 2, 2)).toBe('Полуфинал')
    expect(getOlympicRoundLabel(2, 2, 1)).toBe('Финал')
  })

  it('labels N=8 bracket correctly', () => {
    expect(getOlympicRoundLabel(1, 3, 4)).toBe('1/4 финала')
    expect(getOlympicRoundLabel(2, 3, 2)).toBe('Полуфинал')
    expect(getOlympicRoundLabel(3, 3, 1)).toBe('Финал')
  })

  it('labels N=16 bracket correctly', () => {
    expect(getOlympicRoundLabel(1, 4, 8)).toBe('1/8 финала')
    expect(getOlympicRoundLabel(2, 4, 4)).toBe('1/4 финала')
    expect(getOlympicRoundLabel(3, 4, 2)).toBe('Полуфинал')
    expect(getOlympicRoundLabel(4, 4, 1)).toBe('Финал')
  })
})

describe('getSlotFlexWeight', () => {
  it('doubles flex weight each round', () => {
    expect(getSlotFlexWeight(1)).toBe(1)
    expect(getSlotFlexWeight(2)).toBe(2)
    expect(getSlotFlexWeight(3)).toBe(4)
    expect(getSlotFlexWeight(4)).toBe(8)
  })
})
