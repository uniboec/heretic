import { describe, expect, it } from 'vitest'
import { assignRanks, compareTieBreakMetrics } from '../tieBreak'
import type { AthleteRatingTieBreakMetrics } from '../types'

function metrics(overrides: Partial<AthleteRatingTieBreakMetrics> = {}): AthleteRatingTieBreakMetrics {
  return {
    countableWins: 0,
    submissionChokeWins: 0,
    firstPlaces: 0,
    secondPlaces: 0,
    thirdPlaces: 0,
    bestSingleDisciplineHundredths: 0,
    ...overrides,
  }
}

describe('compareTieBreakMetrics', () => {
  it('prefers more countable wins', () => {
    const left = metrics({ countableWins: 2 })
    const right = metrics({ countableWins: 3 })
    expect(compareTieBreakMetrics(left, right, 'overall')).toBeGreaterThan(0)
  })

  it('uses best single discipline only in overall view', () => {
    const left = metrics({ bestSingleDisciplineHundredths: 5000 })
    const right = metrics({ bestSingleDisciplineHundredths: 4000 })
    expect(compareTieBreakMetrics(left, right, 'overall')).toBeLessThan(0)
    expect(compareTieBreakMetrics(left, right, 'tactic_control')).toBe(0)
  })
})

describe('assignRanks', () => {
  it('assigns shared rank for equal rating and tie-break', () => {
    const tie = metrics({ countableWins: 2, submissionChokeWins: 1 })
    const ranked = assignRanks(
      [
        { viewRatingHundredths: 300, tieBreak: tie },
        { viewRatingHundredths: 300, tieBreak: tie },
        { viewRatingHundredths: 200, tieBreak: metrics() },
      ],
      'overall',
    )

    expect(ranked.map((row) => row.rank)).toEqual([1, 1, 3])
  })

  it('marks zero rating as unranked', () => {
    const ranked = assignRanks(
      [{ viewRatingHundredths: 0, tieBreak: metrics() }],
      'tactic_control',
    )
    expect(ranked[0]?.unranked).toBe(true)
    expect(ranked[0]?.rank).toBeNull()
  })
})
