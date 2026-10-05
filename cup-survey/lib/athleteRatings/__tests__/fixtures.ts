import type {
  AthleteRatingCategorySource,
  AthleteRatingEntryInfo,
  AthleteRatingSettings,
} from '../types'

export const defaultSettings: AthleteRatingSettings = {
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

export function entryInfo(
  entryId: string,
  athleteId: string,
  overrides: Partial<AthleteRatingEntryInfo> = {},
): AthleteRatingEntryInfo {
  return {
    entryId,
    athleteId,
    discipline: 'tactic_control',
    ageDivisionId: 'm_juniors_1',
    displayName: `Athlete ${entryId}`,
    clubName: 'Клуб',
    city: 'Екатеринбург',
    birthDate: '2012-01-01',
    gender: 'male',
    ...overrides,
  }
}

export function categorySource(
  overrides: Partial<AthleteRatingCategorySource> & Pick<AthleteRatingCategorySource, 'categoryKey'>,
): AthleteRatingCategorySource {
  return {
    discipline: 'tactic_control',
    participants: [],
    result: null,
    boutResults: [],
    ...overrides,
  }
}
