import { describe, expect, it } from 'vitest'
import {
  applyAgeCoefficientHundredths,
  formatRatingHundredths,
  placeWithoutWinsHundredths,
} from '../ratingMath'

describe('ratingMath', () => {
  it('formats hundredths with comma', () => {
    expect(formatRatingHundredths(11616)).toBe('116,16')
    expect(formatRatingHundredths(488)).toBe('4,88')
  })

  it('applies age coefficient with rounding', () => {
    expect(applyAgeCoefficientHundredths(13200, 88)).toBe(11616)
    expect(applyAgeCoefficientHundredths(555, 88)).toBe(488)
  })

  it('keeps place without wins precision', () => {
    expect(placeWithoutWinsHundredths(37, 15)).toBe(555)
  })
})
