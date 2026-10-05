import {
  ATHLETE_RATING_AGE_BRACKET_KEYS,
  DEFAULT_AGE_COEFFICIENTS,
} from './constants'
import { isValidAgeCoefficients } from './ageCoefficient'
import type { AgeCoefficients, AthleteRatingSettings } from './types'

export type AthleteRatingSettingsValidationError = {
  field: string
  message: string
}

export function validateAthleteRatingSettingsInput(
  input: Partial<AthleteRatingSettings>,
): AthleteRatingSettingsValidationError[] {
  const errors: AthleteRatingSettingsValidationError[] = []

  if (input.publicTopLimit != null) {
    if (!Number.isInteger(input.publicTopLimit) || input.publicTopLimit <= 0) {
      errors.push({
        field: 'publicTopLimit',
        message: 'Количество спортсменов в ТОПе должно быть целым числом больше 0.',
      })
    }
  }

  const pointFields: Array<keyof AthleteRatingSettings> = [
    'firstPlacePoints',
    'secondPlacePoints',
    'thirdPlacePoints',
    'pointsVictoryPoints',
    'clearAdvantageVictoryPoints',
    'submissionVictoryPoints',
    'chokeVictoryPoints',
    'injuryVictoryPoints',
    'dqVictoryPoints',
  ]

  for (const field of pointFields) {
    const value = input[field]
    if (value == null) continue
    if (!Number.isInteger(value) || value < 0) {
      errors.push({
        field,
        message: 'Баллы должны быть целым числом не меньше 0.',
      })
    }
  }

  if (input.placeWithoutWinPercent != null) {
    if (
      !Number.isInteger(input.placeWithoutWinPercent) ||
      input.placeWithoutWinPercent < 0 ||
      input.placeWithoutWinPercent > 100
    ) {
      errors.push({
        field: 'placeWithoutWinPercent',
        message: 'Процент места без побед должен быть целым числом от 0 до 100.',
      })
    }
  }

  if (input.ageCoefficients != null && !isValidAgeCoefficients(input.ageCoefficients)) {
    errors.push({
      field: 'ageCoefficients',
      message:
        'Возрастные коэффициенты должны содержать все 8 категорий (4-5 … 18+) с целыми значениями > 0.',
    })
  }

  return errors
}

export function normalizeAgeCoefficients(value: unknown): AgeCoefficients {
  if (isValidAgeCoefficients(value)) {
    return value
  }
  return { ...DEFAULT_AGE_COEFFICIENTS }
}
