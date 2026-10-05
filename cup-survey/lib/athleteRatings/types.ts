import type {
  AthleteRatingAgeBracketKey,
  AthleteRatingDiscipline,
  AthleteRatingView,
} from './constants'
import type { AthleteRatingPublicFormula } from './publicFormula'

export type AgeCoefficients = Record<AthleteRatingAgeBracketKey, number>

export type AthleteRatingSettings = {
  tournamentScopeId: string
  publicEnabled: boolean
  publicTopLimit: number
  firstPlacePoints: number
  secondPlacePoints: number
  thirdPlacePoints: number
  placeWithoutWinPercent: number
  pointsVictoryPoints: number
  clearAdvantageVictoryPoints: number
  submissionVictoryPoints: number
  chokeVictoryPoints: number
  injuryVictoryPoints: number
  dqVictoryPoints: number
  ageCoefficients: AgeCoefficients
}

export type AthleteRatingBreakdownLine = {
  label: string
  pointsHundredths: number
}

export type AthleteRatingDisciplineBreakdown = {
  discipline: AthleteRatingDiscipline
  disciplineLabel: string
  lines: AthleteRatingBreakdownLine[]
  rawHundredths: number
  ageBracketKey: AthleteRatingAgeBracketKey
  ageBracketLabel: string
  ageCoeffPercent: number
  ratingHundredths: number
}

export type AthleteRatingTieBreakMetrics = {
  countableWins: number
  submissionChokeWins: number
  firstPlaces: number
  secondPlaces: number
  thirdPlaces: number
  bestSingleDisciplineHundredths: number
}

export type AthleteRatingDisciplineResult = {
  discipline: AthleteRatingDiscipline
  ratingHundredths: number
  placements: number[]
  countableWins: number
  pointsWins: number
  submissionChokeWins: number
  injuryWins: number
  dqWins: number
  forfeitWins: number
  tieBreak: AthleteRatingTieBreakMetrics
  breakdown: AthleteRatingDisciplineBreakdown
}

export type AthleteRatingComputedAthlete = {
  athleteId: string
  displayName: string
  clubName: string
  city: string
  ageYears: number
  ageBracketKey: AthleteRatingAgeBracketKey
  ageBracketLabel: string
  tacticControl: AthleteRatingDisciplineResult | null
  closeControl: AthleteRatingDisciplineResult | null
  overallRatingHundredths: number
  overallTieBreak: AthleteRatingTieBreakMetrics
  anomalies: string[]
}

export type AthleteRatingRankedRow = {
  athleteId: string
  displayName: string
  clubName: string
  city: string
  ageYears: number
  ageBracketLabel: string
  rank: number | null
  unranked: boolean
  viewRatingHundredths: number
  wins: number
  resultsSummary: string
  ratingHundredths: number
  ratingFormatted: string
  tacticControlRatingHundredths: number
  closeControlRatingHundredths: number
  overallRatingHundredths: number
  placementSummary: string
  pointsWins: number
  submissionChokeWins: number
  injuryWins: number
  dqWins: number
  forfeitWins: number
  anomalies: string[]
  breakdown: {
    tacticControl: AthleteRatingDisciplineBreakdown | null
    closeControl: AthleteRatingDisciplineBreakdown | null
    overallRatingHundredths: number
  }
}

export type { AthleteRatingPublicFormula } from './publicFormula'

export type AthleteRatingPublicResponse = {
  publicEnabled: boolean
  topLimit: number
  discipline: AthleteRatingView
  formula: AthleteRatingPublicFormula
  rows: AthleteRatingPublicRow[]
}

export type AthleteRatingPublicRow = {
  rank: number
  athleteId: string
  displayName: string
  clubName: string
  city: string
  ageLabel: string
  resultsSummary: string
  wins: number
  ratingHundredths: number
  ratingFormatted: string
}

export type AthleteRatingAdminResponse = {
  settings: AthleteRatingSettings
  view: AthleteRatingView
  rows: AthleteRatingRankedRow[]
}

export type AthleteRatingCategoryBoutResult = {
  boutId: string
  winnerEntryId: string | null
  loserEntryId: string | null
  victoryMethod: string
  fightOfficiallyStarted: boolean
}

export type AthleteRatingCategoryParticipant = {
  entryId: string
  displayName: string
}

export type AthleteRatingCategorySource = {
  categoryKey: string
  discipline: string
  participants: AthleteRatingCategoryParticipant[]
  result: import('@/lib/brackets/core/types').CategoryResult | null | undefined
  boutResults: AthleteRatingCategoryBoutResult[]
}

export type AthleteRatingEntryInfo = {
  entryId: string
  athleteId: string
  discipline: string
  ageDivisionId: string | null
  displayName: string
  clubName: string
  city: string
  birthDate: string
  gender: string
}
