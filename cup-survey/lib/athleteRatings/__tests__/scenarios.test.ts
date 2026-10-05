import { describe, expect, it } from 'vitest'
import { aggregateAthleteRatings, rankAthletesForView } from '../aggregate'
import { applyPublicTopLimit } from '../publicTopLimit'
import { categorySource, defaultSettings, entryInfo } from './fixtures'

describe('athlete rating scenarios', () => {
  it('awards gold without countable wins at reduced place percent', () => {
    const athletes = aggregateAthleteRatings({
      settings: defaultSettings,
      entryInfoByEntryId: new Map([
        ['e1', entryInfo('e1', 'a1', { displayName: 'Champion Solo' })],
      ]),
      categories: [
        categorySource({
          categoryKey: 'tactic_control:beginner:m_juniors_1:w_66',
          participants: [{ entryId: 'e1', displayName: 'Champion Solo' }],
          result: {
            status: 'complete',
            placements: [{ entryId: 'e1', placement: 1, reason: 'SINGLE_PARTICIPANT' }],
          },
        }),
      ],
    })

    expect(athletes[0]?.tacticControl?.ratingHundredths).toBe(1260)
  })

  it('awards bronze without wins', () => {
    const athletes = aggregateAthleteRatings({
      settings: defaultSettings,
      entryInfoByEntryId: new Map([
        ['e1', entryInfo('e1', 'a1')],
      ]),
      categories: [
        categorySource({
          categoryKey: 'tactic_control:beginner:m_juniors_1:w_66',
          participants: [{ entryId: 'e1', displayName: 'Bronze' }],
          result: {
            status: 'complete',
            placements: [{ entryId: 'e1', placement: 3, reason: 'BRONZE_WINNER' }],
          },
        }),
      ],
    })

    expect(athletes[0]?.tacticControl?.ratingHundredths).toBe(315)
  })

  it('sums multiple submission wins and points-only wins separately', () => {
    const athletes = aggregateAthleteRatings({
      settings: defaultSettings,
      entryInfoByEntryId: new Map([
        ['e1', entryInfo('e1', 'a1')],
      ]),
      categories: [
        categorySource({
          categoryKey: 'tactic_control:beginner:m_juniors_1:w_66',
          participants: [{ entryId: 'e1', displayName: 'Winner' }],
          result: {
            status: 'complete',
            placements: [{ entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' }],
          },
          boutResults: [
            {
              boutId: 'b1',
              winnerEntryId: 'e1',
              loserEntryId: 'e2',
              victoryMethod: 'SUBMISSION',
              fightOfficiallyStarted: true,
            },
            {
              boutId: 'b2',
              winnerEntryId: 'e1',
              loserEntryId: 'e3',
              victoryMethod: 'SUBMISSION',
              fightOfficiallyStarted: true,
            },
            {
              boutId: 'b3',
              winnerEntryId: 'e1',
              loserEntryId: 'e4',
              victoryMethod: 'POINTS',
              fightOfficiallyStarted: true,
            },
          ],
        }),
      ],
    })

    const result = athletes[0]?.tacticControl
    expect(result?.submissionChokeWins).toBe(2)
    expect(result?.pointsWins).toBe(1)
    expect(result?.countableWins).toBe(3)
    expect(result?.ratingHundredths).toBe(18060)
    expect(result?.breakdown.lines.map((line) => line.label)).toEqual([
      '1 место',
      'Победа Болевой приём',
      'Победа Болевой приём',
      'Победа По очкам',
    ])
  })

  it('sums results from all categories in one discipline', () => {
    const athletes = aggregateAthleteRatings({
      settings: defaultSettings,
      entryInfoByEntryId: new Map([
        ['e1', entryInfo('e1', 'a1', { displayName: 'Duplicate A' })],
        ['e2', entryInfo('e2', 'a1', { displayName: 'Duplicate B' })],
      ]),
      categories: [
        categorySource({
          categoryKey: 'tactic_control:beginner:m_juniors_1:w_66',
          participants: [
            { entryId: 'e1', displayName: 'Duplicate A' },
            { entryId: 'e2', displayName: 'Duplicate B' },
          ],
          result: {
            status: 'complete',
            placements: [
              { entryId: 'e1', placement: 2, reason: 'FINAL_LOSER' },
              { entryId: 'e2', placement: 1, reason: 'FINAL_WINNER' },
            ],
          },
          boutResults: [
            {
              boutId: 'b1',
              winnerEntryId: 'e2',
              loserEntryId: 'e1',
              victoryMethod: 'POINTS',
              fightOfficiallyStarted: true,
            },
          ],
        }),
      ],
    })

    expect(athletes).toHaveLength(1)
    expect(athletes[0]?.anomalies).toHaveLength(0)
    expect(athletes[0]?.tacticControl?.placements).toEqual([1, 2])
    expect(athletes[0]?.tacticControl?.ratingHundredths).toBe(10395)
    expect(athletes[0]?.tacticControl?.tieBreak.firstPlaces).toBe(1)
    expect(athletes[0]?.tacticControl?.tieBreak.secondPlaces).toBe(1)
  })

  it('sums ratings and medals across separate categories in one discipline', () => {
    const athletes = aggregateAthleteRatings({
      settings: defaultSettings,
      entryInfoByEntryId: new Map([
        ['e1', entryInfo('e1', 'a1', { displayName: 'Multi Cat' })],
        ['e2', entryInfo('e2', 'a1', { displayName: 'Multi Cat' })],
      ]),
      categories: [
        categorySource({
          categoryKey: 'tactic_control:beginner:m_juniors_1:w_66',
          participants: [{ entryId: 'e1', displayName: 'Multi Cat' }],
          result: {
            status: 'complete',
            placements: [{ entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' }],
          },
          boutResults: [
            {
              boutId: 'b1',
              winnerEntryId: 'e1',
              loserEntryId: 'other-1',
              victoryMethod: 'POINTS',
              fightOfficiallyStarted: true,
            },
          ],
        }),
        categorySource({
          categoryKey: 'tactic_control:beginner:m_juniors_1:w_72',
          participants: [{ entryId: 'e2', displayName: 'Multi Cat' }],
          result: {
            status: 'complete',
            placements: [{ entryId: 'e2', placement: 3, reason: 'BRONZE_WINNER' }],
          },
        }),
      ],
    })

    const result = athletes[0]?.tacticControl
    expect(result?.placements).toEqual([1, 3])
    expect(result?.countableWins).toBe(1)
    expect(result?.ratingHundredths).toBe(9660 + 315)
    expect(result?.tieBreak.firstPlaces).toBe(1)
    expect(result?.tieBreak.thirdPlaces).toBe(1)
  })

  it('excludes athlete with zero TC rating from public TC top', () => {
    const athletes = aggregateAthleteRatings({
      settings: defaultSettings,
      entryInfoByEntryId: new Map([
        [
          'e-tc',
          entryInfo('e-tc', 'a1', { discipline: 'tactic_control', displayName: 'Only CC' }),
        ],
        [
          'e-cc',
          entryInfo('e-cc', 'a1', {
            discipline: 'close_control',
            displayName: 'Only CC',
          }),
        ],
      ]),
      categories: [
        categorySource({
          categoryKey: 'tactic_control:beginner:m_juniors_1:w_66',
          discipline: 'tactic_control',
          participants: [{ entryId: 'e-tc', displayName: 'Only CC' }],
          result: null,
        }),
        categorySource({
          categoryKey: 'close_control:beginner:m_juniors_1:w_66',
          discipline: 'close_control',
          participants: [{ entryId: 'e-cc', displayName: 'Only CC' }],
          result: {
            status: 'complete',
            placements: [{ entryId: 'e-cc', placement: 1, reason: 'FINAL_WINNER' }],
          },
          boutResults: [
            {
              boutId: 'b1',
              winnerEntryId: 'e-cc',
              loserEntryId: 'other',
              victoryMethod: 'POINTS',
              fightOfficiallyStarted: true,
            },
          ],
        }),
      ],
    })

    const tcRows = rankAthletesForView(athletes, 'tactic_control')
    const publicRows = applyPublicTopLimit(tcRows, 10)
    expect(publicRows).toHaveLength(0)
    expect(tcRows[0]?.unranked).toBe(true)
  })

  it('includes tied athletes beyond top limit boundary', () => {
    const athletes = aggregateAthleteRatings({
      settings: defaultSettings,
      entryInfoByEntryId: new Map([
        ['e1', entryInfo('e1', 'a1')],
        ['e2', entryInfo('e2', 'a2')],
        ['e3', entryInfo('e3', 'a3')],
        ['e4', entryInfo('e4', 'a4')],
        ['e5', entryInfo('e5', 'a5')],
      ]),
      categories: [
        categorySource({
          categoryKey: 'tactic_control:beginner:m_juniors_1:w_66',
          participants: [
            { entryId: 'e1', displayName: 'A1' },
            { entryId: 'e2', displayName: 'A2' },
            { entryId: 'e3', displayName: 'A3' },
            { entryId: 'e4', displayName: 'A4' },
            { entryId: 'e5', displayName: 'A5' },
          ],
          result: {
            status: 'complete',
            placements: [
              { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' },
              { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER' },
              { entryId: 'e3', placement: 3, reason: 'BRONZE_WINNER' },
              { entryId: 'e4', placement: 3, reason: 'BRONZE_WINNER' },
              { entryId: 'e5', placement: 3, reason: 'BRONZE_WINNER' },
            ],
          },
          boutResults: [
            {
              boutId: 'b1',
              winnerEntryId: 'e1',
              loserEntryId: 'e2',
              victoryMethod: 'POINTS',
              fightOfficiallyStarted: true,
            },
          ],
        }),
      ],
    })

    const ranked = rankAthletesForView(athletes, 'overall')
    const publicRows = applyPublicTopLimit(ranked, 3)
    const bronzeRows = publicRows.filter((row) => row.rank === 3)
    expect(bronzeRows.length).toBeGreaterThanOrEqual(3)
  })
})
