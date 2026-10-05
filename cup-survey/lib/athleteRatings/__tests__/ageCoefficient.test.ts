import { describe, expect, it } from 'vitest'
import { resolveAgeBracketKey } from '../ageCoefficient'
import { defaultSettings } from './fixtures'
import { aggregateAthleteRatings, rankAthletesForView } from '../aggregate'
import { categorySource, entryInfo } from './fixtures'

describe('resolveAgeBracketKey', () => {
  it('prefers ageDivisionId over birthDate fallback', () => {
    const fromDivision = resolveAgeBracketKey({
      ageDivisionId: 'm_juniors_1',
      birthDate: '2000-01-01',
    })
    const fromBirthDate = resolveAgeBracketKey({
      ageDivisionId: null,
      birthDate: '2000-01-01',
    })

    expect(fromDivision).toBe('16-17')
    expect(fromBirthDate).toBe('18+')
  })
})

describe('age coefficient in aggregate', () => {
  it('applies age coefficient from division to final rating', () => {
    const athletes = aggregateAthleteRatings({
      settings: defaultSettings,
      entryInfoByEntryId: new Map([
        ['e1', entryInfo('e1', 'a1', { ageDivisionId: 'm_youths_2' })],
      ]),
      categories: [
        categorySource({
          categoryKey: 'tactic_control:beginner:m_youths_2:w_41',
          participants: [{ entryId: 'e1', displayName: 'Youth' }],
          result: {
            status: 'complete',
            placements: [{ entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' }],
          },
          boutResults: [
            {
              boutId: 'b1',
              winnerEntryId: 'e1',
              loserEntryId: 'other',
              victoryMethod: 'SUBMISSION',
              fightOfficiallyStarted: true,
            },
            {
              boutId: 'b2',
              winnerEntryId: 'e1',
              loserEntryId: 'other-2',
              victoryMethod: 'POINTS',
              fightOfficiallyStarted: true,
            },
          ],
        }),
      ],
    })

    const ranked = rankAthletesForView(athletes, 'overall')
    expect(ranked[0]?.ratingHundredths).toBe(11616)
    expect(ranked[0]?.ratingFormatted).toBe('116,16')
  })
})
