import { describe, expect, it } from 'vitest'
import { applyPublicTopLimit } from '../publicTopLimit'
import type { AthleteRatingRankedRow } from '../types'

function row(rank: number | null, hundredths: number): AthleteRatingRankedRow {
  return {
    athleteId: `a-${rank}-${hundredths}`,
    displayName: `Athlete ${rank}`,
    clubName: '',
    city: '',
    ageYears: 14,
    ageBracketLabel: '14–15',
    rank,
    unranked: rank == null,
    viewRatingHundredths: hundredths,
    wins: 1,
    resultsSummary: '—',
    ratingHundredths: hundredths,
    ratingFormatted: String(hundredths),
    tacticControlRatingHundredths: 0,
    closeControlRatingHundredths: 0,
    overallRatingHundredths: hundredths,
    placementSummary: '—',
    pointsWins: 0,
    submissionChokeWins: 0,
    injuryWins: 0,
    dqWins: 0,
    forfeitWins: 0,
    anomalies: [],
    breakdown: {
      tacticControl: null,
      closeControl: null,
      overallRatingHundredths: hundredths,
    },
  }
}

describe('applyPublicTopLimit', () => {
  it('includes all athletes sharing rank at boundary', () => {
    const rows = [
      row(1, 300),
      row(2, 200),
      row(3, 100),
      row(3, 100),
      row(3, 100),
      row(6, 90),
    ]
    const result = applyPublicTopLimit(rows, 3)
    expect(result).toHaveLength(5)
    expect(result.every((item) => item.rank === 3 || (item.rank ?? 0) < 3)).toBe(true)
  })

  it('excludes unranked rows', () => {
    const rows = [row(null, 0), row(1, 100)]
    expect(applyPublicTopLimit(rows, 10)).toHaveLength(1)
  })
})
