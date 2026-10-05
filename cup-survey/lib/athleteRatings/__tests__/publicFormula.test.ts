import { describe, expect, it } from 'vitest'
import {
  buildAthleteRatingPublicFormula,
  formatPlaceWithoutWinsPoints,
} from '../publicFormula'
import { defaultSettings } from './fixtures'

describe('publicFormula', () => {
  it('builds public formula from settings', () => {
    const formula = buildAthleteRatingPublicFormula(defaultSettings)

    expect(formula.placePoints).toEqual({
      first: 60,
      second: 35,
      third: 15,
    })
    expect(formula.placeWithoutWinPercent).toBe(20)
    expect(formula.victoryPoints.pointsVictoryPoints).toBe(32)
    expect(formula.ageCoefficients).toHaveLength(8)
    expect(formula.ageCoefficients.find((row) => row.bracketLabel === '14–15')?.percent).toBe(100)
  })

  it('formats place without wins as percent of full place points', () => {
    expect(formatPlaceWithoutWinsPoints(60, 20)).toBe('12')
    expect(formatPlaceWithoutWinsPoints(15, 20)).toBe('3')
  })
})
