export const ATHLETE_RATING_DISCIPLINES = ['tactic_control', 'close_control'] as const

export type AthleteRatingDiscipline = (typeof ATHLETE_RATING_DISCIPLINES)[number]

export type AthleteRatingView = 'overall' | AthleteRatingDiscipline

export const ATHLETE_RATING_AGE_BRACKET_KEYS = [
  '4-5',
  '6-7',
  '8-9',
  '10-11',
  '12-13',
  '14-15',
  '16-17',
  '18+',
] as const

export type AthleteRatingAgeBracketKey = (typeof ATHLETE_RATING_AGE_BRACKET_KEYS)[number]

export const DEFAULT_AGE_COEFFICIENTS: Record<AthleteRatingAgeBracketKey, number> = {
  '4-5': 35,
  '6-7': 45,
  '8-9': 60,
  '10-11': 75,
  '12-13': 88,
  '14-15': 100,
  '16-17': 105,
  '18+': 110,
}

/** Forfeit / No Show — fixed at 0, not configurable. */
export const FORFEIT_VICTORY_POINTS = 0

export const DISCIPLINE_SHORT_LABELS: Record<AthleteRatingDiscipline, string> = {
  tactic_control: 'TC',
  close_control: 'CC',
}
