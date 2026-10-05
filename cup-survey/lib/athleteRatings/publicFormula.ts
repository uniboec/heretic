import { getAgeBracketLabel } from './ageCoefficient'
import { ATHLETE_RATING_AGE_BRACKET_KEYS } from './constants'
import type { AthleteRatingSettings } from './types'

export type AthleteRatingPublicFormula = {
  placePoints: {
    first: number
    second: number
    third: number
  }
  placeWithoutWinPercent: number
  victoryPoints: {
    pointsVictoryPoints: number
    clearAdvantageVictoryPoints: number
    submissionVictoryPoints: number
    chokeVictoryPoints: number
    injuryVictoryPoints: number
    dqVictoryPoints: number
  }
  ageCoefficients: Array<{
    bracketLabel: string
    percent: number
  }>
}

export function buildAthleteRatingPublicFormula(
  settings: AthleteRatingSettings,
): AthleteRatingPublicFormula {
  return {
    placePoints: {
      first: settings.firstPlacePoints,
      second: settings.secondPlacePoints,
      third: settings.thirdPlacePoints,
    },
    placeWithoutWinPercent: settings.placeWithoutWinPercent,
    victoryPoints: {
      pointsVictoryPoints: settings.pointsVictoryPoints,
      clearAdvantageVictoryPoints: settings.clearAdvantageVictoryPoints,
      submissionVictoryPoints: settings.submissionVictoryPoints,
      chokeVictoryPoints: settings.chokeVictoryPoints,
      injuryVictoryPoints: settings.injuryVictoryPoints,
      dqVictoryPoints: settings.dqVictoryPoints,
    },
    ageCoefficients: ATHLETE_RATING_AGE_BRACKET_KEYS.map((key) => ({
      bracketLabel: getAgeBracketLabel(key),
      percent: settings.ageCoefficients[key],
    })),
  }
}

export function formatPlaceWithoutWinsPoints(
  placePoints: number,
  placeWithoutWinPercent: number,
): string {
  const value = (placePoints * placeWithoutWinPercent) / 100
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}
