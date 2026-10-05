import { getAgeDivision, type FseAgeDivision } from '@/lib/config/fseCategories'
import { getAgeOnEventDate } from '@/lib/registration/categoryRules'
import { tournamentInfo } from '@/lib/config/tournament'
import {
  ATHLETE_RATING_AGE_BRACKET_KEYS,
  type AthleteRatingAgeBracketKey,
} from './constants'
import type { AgeCoefficients } from './types'

const AGE_BRACKET_LABELS: Record<AthleteRatingAgeBracketKey, string> = {
  '4-5': '4–5',
  '6-7': '6–7',
  '8-9': '8–9',
  '10-11': '10–11',
  '12-13': '12–13',
  '14-15': '14–15',
  '16-17': '16–17',
  '18+': '18+',
}

export function getAgeBracketLabel(key: AthleteRatingAgeBracketKey): string {
  return AGE_BRACKET_LABELS[key]
}

function ageToBracketKey(age: number): AthleteRatingAgeBracketKey {
  if (age <= 5) return '4-5'
  if (age <= 7) return '6-7'
  if (age <= 9) return '8-9'
  if (age <= 11) return '10-11'
  if (age <= 13) return '12-13'
  if (age <= 15) return '14-15'
  if (age <= 17) return '16-17'
  return '18+'
}

function divisionToBracketKey(division: FseAgeDivision): AthleteRatingAgeBracketKey {
  if (division.ageMax != null && division.ageMax <= 5) return '4-5'
  if (division.ageMax != null && division.ageMax <= 7) return '6-7'
  if (division.ageMax != null && division.ageMax <= 9) return '8-9'
  if (division.ageMax != null && division.ageMax <= 11) return '10-11'
  if (division.ageMax != null && division.ageMax <= 13) return '12-13'
  if (division.ageMax != null && division.ageMax <= 15) return '14-15'
  if (division.ageMax != null && division.ageMax <= 17) return '16-17'
  return '18+'
}

export function resolveAgeBracketKey(input: {
  ageDivisionId: string | null
  birthDate: string
}): AthleteRatingAgeBracketKey {
  if (input.ageDivisionId) {
    const division = getAgeDivision(input.ageDivisionId)
    if (division) {
      return divisionToBracketKey(division)
    }
  }
  const age = getAgeOnEventDate(input.birthDate, tournamentInfo.eventDate)
  return ageToBracketKey(age)
}

export function getAgeCoeffPercent(
  bracketKey: AthleteRatingAgeBracketKey,
  coefficients: AgeCoefficients,
): number {
  return coefficients[bracketKey]
}

export function isValidAgeCoefficients(value: unknown): value is AgeCoefficients {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return ATHLETE_RATING_AGE_BRACKET_KEYS.every((key) => {
    const coeff = record[key]
    return typeof coeff === 'number' && Number.isInteger(coeff) && coeff > 0
  })
}
