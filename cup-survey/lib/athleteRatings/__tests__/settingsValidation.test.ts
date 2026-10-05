import { describe, expect, it } from 'vitest'
import { validateAthleteRatingSettingsInput } from '../settingsValidation'

describe('validateAthleteRatingSettingsInput', () => {
  it('rejects invalid top limit and place percent', () => {
    const errors = validateAthleteRatingSettingsInput({
      publicTopLimit: 0,
      placeWithoutWinPercent: 120,
      firstPlacePoints: -1,
    })
    expect(errors.some((error) => error.field === 'publicTopLimit')).toBe(true)
    expect(errors.some((error) => error.field === 'placeWithoutWinPercent')).toBe(true)
    expect(errors.some((error) => error.field === 'firstPlacePoints')).toBe(true)
  })

  it('rejects incomplete age coefficients', () => {
    const errors = validateAthleteRatingSettingsInput({
      ageCoefficients: { '4-5': 35 },
    })
    expect(errors.some((error) => error.field === 'ageCoefficients')).toBe(true)
  })
})
