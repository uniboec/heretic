import { describe, expect, it } from 'vitest'
import {
  aggregateTeamRankings,
  computeRankingStatus,
  rankTeamRows,
} from '../aggregate'
import type { TeamRankingCategorySource, TeamRankingRow, TeamRankingSettings } from '../types'

const defaultSettings: TeamRankingSettings = {
  tournamentScopeId: 'cup-2026',
  firstPlacePoints: 5,
  secondPlacePoints: 3,
  thirdPlacePoints: 2,
  soloParticipantPointsMode: 'STANDARD',
  soloParticipantFirstPlacePoints: null,
}

function makeRow(
  overrides: Partial<TeamRankingRow> & Pick<TeamRankingRow, 'clubName'>,
): TeamRankingRow {
  const city = overrides.city ?? 'Город'
  return {
    rank: 0,
    clubIdentity: overrides.clubIdentity ?? `${overrides.clubName}::${city}`,
    city,
    points: 0,
    firstPlaces: 0,
    secondPlaces: 0,
    thirdPlaces: 0,
    wins: 0,
    fights: 0,
    ...overrides,
  }
}

function makeCategory(
  overrides: Partial<TeamRankingCategorySource> & Pick<TeamRankingCategorySource, 'categoryKey'>,
): TeamRankingCategorySource {
  return {
    discipline: 'tactic_control',
    participants: [],
    result: null,
    boutResults: [],
    ...overrides,
  }
}

describe('aggregateTeamRankings', () => {
  it('includes clubs with zero metrics from participants', () => {
    const rows = aggregateTeamRankings({
      discipline: 'all',
      settings: defaultSettings,
      categories: [
        makeCategory({
          categoryKey: 'cat-a',
          participants: [{ entryId: 'e1', clubName: 'Боец', city: 'Город' }],
        }),
      ],
    }).rows

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      clubName: 'Боец',
      points: 0,
      firstPlaces: 0,
      wins: 0,
      fights: 0,
    })
  })

  it('excludes athletes without a club', () => {
    const rows = aggregateTeamRankings({
      discipline: 'all',
      settings: defaultSettings,
      categories: [
        makeCategory({
          categoryKey: 'cat-a',
          participants: [
            { entryId: 'e1', clubName: '', city: 'Город' },
            { entryId: 'e2', clubName: 'Сила', city: 'Город' },
          ],
          result: {
            status: 'complete',
            placements: [{ entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' }],
          },
        }),
      ],
    }).rows

    expect(rows).toHaveLength(1)
    expect(rows[0]?.clubName).toBe('Сила')
    expect(rows[0]?.firstPlaces).toBe(0)
  })

  it('counts provisional placements immediately', () => {
    const rows = aggregateTeamRankings({
      discipline: 'all',
      settings: defaultSettings,
      categories: [
        makeCategory({
          categoryKey: 'cat-a',
          participants: [
            { entryId: 'e1', clubName: 'Боец', city: 'Город' },
            { entryId: 'e2', clubName: 'Сила', city: 'Город' },
          ],
          result: {
            status: 'in_progress',
            placements: [
              { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER', provisional: true },
              { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER', provisional: true },
            ],
          },
        }),
      ],
    }).rows

    const fighter = rows.find((row) => row.clubName === 'Боец')
    const force = rows.find((row) => row.clubName === 'Сила')

    expect(fighter?.points).toBe(5)
    expect(fighter?.firstPlaces).toBe(1)
    expect(force?.points).toBe(3)
    expect(force?.secondPlaces).toBe(1)
  })

  it('applies solo participant CUSTOM mode to points', () => {
    const rows = aggregateTeamRankings({
      discipline: 'all',
      settings: {
        ...defaultSettings,
        soloParticipantPointsMode: 'CUSTOM',
        soloParticipantFirstPlacePoints: 2,
      },
      categories: [
        makeCategory({
          categoryKey: 'cat-a',
          participants: [{ entryId: 'e1', clubName: 'Боец', city: 'Город' }],
          result: {
            status: 'complete',
            placements: [{ entryId: 'e1', placement: 1, reason: 'SINGLE_PARTICIPANT' }],
          },
        }),
      ],
    }).rows

    expect(rows[0]?.firstPlaces).toBe(1)
    expect(rows[0]?.points).toBe(2)
  })

  it('applies solo participant EXCLUDE mode to points only', () => {
    const rows = aggregateTeamRankings({
      discipline: 'all',
      settings: {
        ...defaultSettings,
        soloParticipantPointsMode: 'EXCLUDE',
      },
      categories: [
        makeCategory({
          categoryKey: 'cat-a',
          participants: [{ entryId: 'e1', clubName: 'Боец', city: 'Город' }],
          result: {
            status: 'complete',
            placements: [{ entryId: 'e1', placement: 1, reason: 'SINGLE_PARTICIPANT' }],
          },
        }),
      ],
    }).rows

    expect(rows[0]?.firstPlaces).toBe(1)
    expect(rows[0]?.points).toBe(0)
  })

  it('filters medals and bouts by discipline', () => {
    const rows = aggregateTeamRankings({
      discipline: 'tactic_control',
      settings: defaultSettings,
      categories: [
        makeCategory({
          categoryKey: 'tc',
          discipline: 'tactic_control',
          participants: [{ entryId: 'e1', clubName: 'Боец', city: 'Город' }],
          result: {
            status: 'complete',
            placements: [{ entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' }],
          },
          boutResults: [
            {
              boutId: 'tc::bout-1',
              winnerEntryId: 'e1',
              loserEntryId: 'e2',
              victoryMethod: 'POINTS',
            },
          ],
        }),
        makeCategory({
          categoryKey: 'cc',
          discipline: 'close_control',
          participants: [{ entryId: 'e3', clubName: 'Боец', city: 'Город' }],
          result: {
            status: 'complete',
            placements: [{ entryId: 'e3', placement: 1, reason: 'FINAL_WINNER' }],
          },
        }),
      ],
    }).rows

    expect(rows[0]?.points).toBe(5)
    expect(rows[0]?.firstPlaces).toBe(1)
    expect(rows[0]?.wins).toBe(1)
    expect(rows[0]?.fights).toBe(1)
  })

  it('orders tied teams by club name for display only, not rank', () => {
    const rows = aggregateTeamRankings({
      discipline: 'all',
      settings: defaultSettings,
      categories: [
        makeCategory({
          categoryKey: 'cat-a',
          participants: [
            { entryId: 'e1', clubName: 'Клуб', city: 'Б' },
            { entryId: 'e2', clubName: 'Клуб', city: 'А' },
            { entryId: 'e3', clubName: 'Альфа', city: 'Город' },
          ],
        }),
      ],
    }).rows

    expect(rows.map((row) => row.clubIdentity)).toEqual([
      'Альфа::Город',
      'Клуб::А',
      'Клуб::Б',
    ])
    expect(rows.every((row) => row.rank === 1)).toBe(true)
  })

  it('computes rankingStatus per selected discipline', () => {
    const categories = [
      makeCategory({
        categoryKey: 'tc-done',
        discipline: 'tactic_control',
        result: { status: 'complete', placements: [] },
      }),
      makeCategory({
        categoryKey: 'cc-open',
        discipline: 'close_control',
        result: { status: 'in_progress', placements: [] },
      }),
    ]

    expect(
      aggregateTeamRankings({
        discipline: 'tactic_control',
        settings: defaultSettings,
        categories,
      }).rankingStatus,
    ).toBe('complete')

    expect(
      aggregateTeamRankings({
        discipline: 'all',
        settings: defaultSettings,
        categories,
      }).rankingStatus,
    ).toBe('in_progress')
  })

  it('counts each bout once when only active results are provided', () => {
    const rows = aggregateTeamRankings({
      discipline: 'all',
      settings: defaultSettings,
      categories: [
        makeCategory({
          categoryKey: 'cat-a',
          participants: [
            { entryId: 'e1', clubName: 'Боец', city: 'Город' },
            { entryId: 'e2', clubName: 'Сила', city: 'Город' },
          ],
          boutResults: [
            {
              boutId: 'cat-a::bout-1',
              winnerEntryId: 'e1',
              loserEntryId: 'e2',
              victoryMethod: 'POINTS',
            },
          ],
        }),
      ],
    }).rows

    const fighter = rows.find((row) => row.clubName === 'Боец')
    const force = rows.find((row) => row.clubName === 'Сила')

    expect(fighter?.wins).toBe(1)
    expect(fighter?.fights).toBe(1)
    expect(force?.wins).toBe(0)
    expect(force?.fights).toBe(1)
  })

  it('assigns tied ranks by ranking metrics only', () => {
    const rows = aggregateTeamRankings({
      discipline: 'all',
      settings: defaultSettings,
      categories: [
        makeCategory({
          categoryKey: 'cat-a',
          participants: [
            { entryId: 'e1', clubName: 'Alpha', city: 'A' },
            { entryId: 'e2', clubName: 'Beta', city: 'B' },
          ],
          result: {
            status: 'complete',
            placements: [{ entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' }],
          },
        }),
        makeCategory({
          categoryKey: 'cat-b',
          participants: [{ entryId: 'e3', clubName: 'Beta', city: 'B' }],
          result: {
            status: 'complete',
            placements: [{ entryId: 'e3', placement: 1, reason: 'FINAL_WINNER' }],
          },
        }),
      ],
    }).rows

    expect(rows[0]?.rank).toBe(1)
    expect(rows[1]?.rank).toBe(1)
    expect(rows[0]?.points).toBe(5)
    expect(rows[1]?.points).toBe(5)
  })
})

describe('rankTeamRows tie-break', () => {
  it('ranks higher team with more first places at equal points', () => {
    const rows = rankTeamRows([
      makeRow({
        clubName: 'А',
        points: 75,
        firstPlaces: 10,
        secondPlaces: 5,
        thirdPlaces: 5,
        wins: 31,
      }),
      makeRow({
        clubName: 'Б',
        points: 70,
        firstPlaces: 8,
        secondPlaces: 6,
        thirdPlaces: 6,
        wins: 28,
      }),
      makeRow({
        clubName: 'В',
        points: 70,
        firstPlaces: 7,
        secondPlaces: 8,
        thirdPlaces: 5,
        wins: 35,
      }),
    ])

    expect(rows.map((row) => ({ clubName: row.clubName, rank: row.rank }))).toEqual([
      { clubName: 'А', rank: 1 },
      { clubName: 'Б', rank: 2 },
      { clubName: 'В', rank: 3 },
    ])
  })

  it('ranks higher team with more wins when medal counts are equal', () => {
    const rows = rankTeamRows([
      makeRow({ clubName: 'А', points: 82, firstPlaces: 12, secondPlaces: 5, thirdPlaces: 4, wins: 20 }),
      makeRow({
        clubName: 'Б',
        points: 70,
        firstPlaces: 8,
        secondPlaces: 6,
        thirdPlaces: 6,
        wins: 28,
      }),
      makeRow({
        clubName: 'В',
        points: 70,
        firstPlaces: 8,
        secondPlaces: 6,
        thirdPlaces: 6,
        wins: 25,
      }),
    ])

    expect(rows.map((row) => ({ clubName: row.clubName, rank: row.rank }))).toEqual([
      { clubName: 'А', rank: 1 },
      { clubName: 'Б', rank: 2 },
      { clubName: 'В', rank: 3 },
    ])
  })

  it('assigns classic 1, 2, 2, 4 ranks when teams share all ranking metrics', () => {
    const rows = rankTeamRows([
      makeRow({ clubName: 'А', points: 82, firstPlaces: 12, secondPlaces: 5, thirdPlaces: 4, wins: 20 }),
      makeRow({ clubName: 'Б', points: 70, firstPlaces: 8, secondPlaces: 6, thirdPlaces: 6, wins: 28 }),
      makeRow({ clubName: 'В', points: 70, firstPlaces: 8, secondPlaces: 6, thirdPlaces: 6, wins: 28 }),
      makeRow({ clubName: 'Г', points: 64, firstPlaces: 7, secondPlaces: 5, thirdPlaces: 5, wins: 22 }),
    ])

    expect(rows.map((row) => ({ clubName: row.clubName, rank: row.rank }))).toEqual([
      { clubName: 'А', rank: 1 },
      { clubName: 'Б', rank: 2 },
      { clubName: 'В', rank: 2 },
      { clubName: 'Г', rank: 4 },
    ])
  })

  it('does not use fights when assigning rank', () => {
    const rows = rankTeamRows([
      makeRow({
        clubName: 'Б',
        points: 70,
        firstPlaces: 8,
        secondPlaces: 6,
        thirdPlaces: 6,
        wins: 28,
        fights: 40,
      }),
      makeRow({
        clubName: 'В',
        points: 70,
        firstPlaces: 8,
        secondPlaces: 6,
        thirdPlaces: 6,
        wins: 28,
        fights: 10,
      }),
    ])

    expect(rows[0]?.rank).toBe(1)
    expect(rows[1]?.rank).toBe(1)
  })
})

describe('computeRankingStatus', () => {
  it('is in_progress when a relevant category has no result', () => {
    expect(
      computeRankingStatus([
        makeCategory({ categoryKey: 'a', result: { status: 'complete', placements: [] } }),
        makeCategory({ categoryKey: 'b', result: null }),
      ]),
    ).toBe('in_progress')
  })

  it('is complete only when every relevant category is complete', () => {
    expect(
      computeRankingStatus([
        makeCategory({ categoryKey: 'a', result: { status: 'complete', placements: [] } }),
        makeCategory({ categoryKey: 'b', result: { status: 'complete', placements: [] } }),
      ]),
    ).toBe('complete')
  })
})
