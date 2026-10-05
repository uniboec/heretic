import { describe, expect, it } from 'vitest'
import { fseAgeDivisions } from '../../config/fseCategories'
import {
  DURATION_BANDS,
  defaultDurationMinutesForAge,
  defaultDurationMinutesForDivisionId,
  getDefaultDurationTable,
} from '../boutDuration'

describe('boutDuration FSE band invariant', () => {
  it('maps every FSE division to exactly one default band', () => {
    for (const division of fseAgeDivisions) {
      const minutes = defaultDurationMinutesForAge(division.ageMin, division.ageMax)
      const matchingBands = DURATION_BANDS.filter((band) => {
        const whollyInBand =
          division.ageMin >= band.ageMin &&
          (band.ageMax === null || (division.ageMax ?? division.ageMin) <= band.ageMax)
        return whollyInBand
      })

      expect(matchingBands).toHaveLength(1)
      expect(minutes).toBe(matchingBands[0]!.minutes)
      expect(defaultDurationMinutesForDivisionId(division.id)).toBe(minutes)
    }
  })

  it('getDefaultDurationTable covers all configured divisions', () => {
    const table = getDefaultDurationTable()
    expect(table).toHaveLength(fseAgeDivisions.length)
    expect(new Set(table.map((row) => row.ageDivisionId)).size).toBe(fseAgeDivisions.length)
  })
})
