import { describe, expect, it } from 'vitest'
import { aggregateAthleteRatings, rankAthletesForView } from '../aggregate'
import { categorySource, defaultSettings, entryInfo } from './fixtures'

describe('view-specific ranked fields', () => {
  const athletes = aggregateAthleteRatings({
    settings: defaultSettings,
    entryInfoByEntryId: new Map([
      ['e-tc', entryInfo('e-tc', 'a1', { discipline: 'tactic_control', displayName: 'Mixed' })],
      ['e-cc', entryInfo('e-cc', 'a1', { discipline: 'close_control', displayName: 'Mixed' })],
    ]),
    categories: [
      categorySource({
        categoryKey: 'tactic_control:beginner:m_juniors_1:w_66',
        discipline: 'tactic_control',
        participants: [{ entryId: 'e-tc', displayName: 'Mixed' }],
        result: {
          status: 'complete',
          placements: [{ entryId: 'e-tc', placement: 1, reason: 'FINAL_WINNER' }],
        },
        boutResults: [
          {
            boutId: 'b1',
            winnerEntryId: 'e-tc',
            loserEntryId: 'other',
            victoryMethod: 'SUBMISSION',
            fightOfficiallyStarted: true,
          },
        ],
      }),
      categorySource({
        categoryKey: 'close_control:beginner:m_juniors_1:w_66',
        discipline: 'close_control',
        participants: [{ entryId: 'e-cc', displayName: 'Mixed' }],
        result: null,
      }),
    ],
  })

  it('uses overall metrics in overall view', () => {
    const overall = rankAthletesForView(athletes, 'overall')[0]
    expect(overall?.wins).toBe(1)
    expect(overall?.resultsSummary).toContain('TC')
    expect(overall?.ratingHundredths).toBe(overall?.overallRatingHundredths)
    expect(overall?.unranked).toBe(false)
  })

  it('marks athlete unranked in TC view when TC rating is zero', () => {
    const tc = rankAthletesForView(athletes, 'tactic_control')[0]
    expect(tc?.wins).toBe(1)
    expect(tc?.resultsSummary).toContain('TC')
    expect(tc?.ratingHundredths).toBe(tc?.tacticControlRatingHundredths)
    expect(tc?.unranked).toBe(false)
  })

  it('marks athlete unranked in CC view when CC rating is zero', () => {
    const cc = rankAthletesForView(athletes, 'close_control')[0]
    expect(cc?.wins).toBe(0)
    expect(cc?.resultsSummary).toBe('—')
    expect(cc?.ratingHundredths).toBe(0)
    expect(cc?.unranked).toBe(true)
    expect(cc?.rank).toBeNull()
  })

  it('keeps overall rating when ranking by a single discipline', () => {
    const tc = rankAthletesForView(athletes, 'tactic_control')[0]
    const cc = rankAthletesForView(athletes, 'close_control')[0]

    expect(tc?.overallRatingHundredths).toBeGreaterThan(0)
    expect(cc?.overallRatingHundredths).toBe(tc?.overallRatingHundredths)
    expect(cc?.ratingHundredths).toBe(0)
  })
})
