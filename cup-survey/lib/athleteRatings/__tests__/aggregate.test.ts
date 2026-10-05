import { describe, expect, it } from 'vitest'
import { aggregateAthleteRatings, rankAthletesForView } from '../aggregate'
import type {
  AthleteRatingCategorySource,
  AthleteRatingEntryInfo,
  AthleteRatingSettings,
} from '../types'

const settings: AthleteRatingSettings = {
  tournamentScopeId: 'cup-2026',
  publicEnabled: true,
  publicTopLimit: 10,
  firstPlacePoints: 60,
  secondPlacePoints: 35,
  thirdPlacePoints: 15,
  placeWithoutWinPercent: 20,
  pointsVictoryPoints: 32,
  clearAdvantageVictoryPoints: 36,
  submissionVictoryPoints: 40,
  chokeVictoryPoints: 40,
  injuryVictoryPoints: 20,
  dqVictoryPoints: 10,
  ageCoefficients: {
    '4-5': 35,
    '6-7': 45,
    '8-9': 60,
    '10-11': 75,
    '12-13': 88,
    '14-15': 100,
    '16-17': 105,
    '18+': 110,
  },
}

const entryInfoByEntryId = new Map<string, AthleteRatingEntryInfo>([
  [
    'e-tc',
    {
      entryId: 'e-tc',
      athleteId: 'athlete-1',
      discipline: 'tactic_control',
      ageDivisionId: 'm_youths_2',
      displayName: 'Иванов Иван',
      clubName: 'Клуб А',
      city: 'Екатеринбург',
      birthDate: '2012-01-01',
      gender: 'male',
    },
  ],
  [
    'e-cc',
    {
      entryId: 'e-cc',
      athleteId: 'athlete-1',
      discipline: 'close_control',
      ageDivisionId: 'm_youths_2',
      displayName: 'Иванов Иван',
      clubName: 'Клуб А',
      city: 'Екатеринбург',
      birthDate: '2012-01-01',
      gender: 'male',
    },
  ],
])

const categories: AthleteRatingCategorySource[] = [
  {
    categoryKey: 'tactic_control:novice:m_youths_2:m_youths_2_w_le_41',
    discipline: 'tactic_control',
    participants: [{ entryId: 'e-tc', displayName: 'Иванов Иван' }],
    result: {
      status: 'complete',
      placements: [{ entryId: 'e-tc', placement: 1, reason: 'FINAL_WINNER' }],
    },
    boutResults: [
      {
        boutId: 'b1',
        winnerEntryId: 'e-tc',
        loserEntryId: 'other',
        victoryMethod: 'POINTS',
        fightOfficiallyStarted: true,
      },
    ],
  },
  {
    categoryKey: 'close_control:novice:m_youths_2:m_youths_2_w_le_41',
    discipline: 'close_control',
    participants: [{ entryId: 'e-cc', displayName: 'Иванов Иван' }],
    result: {
      status: 'complete',
      placements: [{ entryId: 'e-cc', placement: 2, reason: 'FINAL_LOSER' }],
    },
    boutResults: [],
  },
]

describe('aggregateAthleteRatings', () => {
  it('merges TC and CC by athleteId', () => {
    const athletes = aggregateAthleteRatings({
      categories,
      entryInfoByEntryId,
      settings,
    })
    expect(athletes).toHaveLength(1)
    expect(athletes[0]?.tacticControl?.placements).toEqual([1])
    expect(athletes[0]?.closeControl?.placements).toEqual([2])
    expect(athletes[0]?.overallRatingHundredths).toBeGreaterThan(0)
  })

  it('ranks TC view independently from overall', () => {
    const athletes = aggregateAthleteRatings({
      categories,
      entryInfoByEntryId,
      settings,
    })
    const overall = rankAthletesForView(athletes, 'overall')
    const tc = rankAthletesForView(athletes, 'tactic_control')
    expect(overall[0]?.overallRatingHundredths).toBeGreaterThan(tc[0]?.tacticControlRatingHundredths ?? 0)
  })
})
