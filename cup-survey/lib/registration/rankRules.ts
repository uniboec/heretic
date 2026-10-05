import {
  normalizeSportRankId,
  sportRankGroups,
  type SportRankGroup,
  type SportRankId,
} from '../config/ranks'
import { getAthleteAgeOnTournamentDate } from './categoryRules'

export { getAthleteAgeOnTournamentDate } from './categoryRules'

const CHILD_MAX_AGE_EXCLUSIVE = 12
const YOUTH_MIN_AGE = 12
const YOUTH_MAX_AGE = 17
const KMS_MIN_AGE = 14
const ADULT_MIN_AGE = 18

export function isRankAllowedForAge(rankId: string, age: number): boolean {
  const rank = normalizeSportRankId(rankId)
  if (rank === 'none') return true
  if (rank.startsWith('child_')) return age < CHILD_MAX_AGE_EXCLUSIVE
  if (rank.startsWith('youth_')) return age >= YOUTH_MIN_AGE && age <= YOUTH_MAX_AGE
  if (rank === 'kms') return age >= KMS_MIN_AGE
  if (rank.startsWith('adult_')) return age >= ADULT_MIN_AGE
  if (rank === 'ms' || rank === 'msmk') return age >= ADULT_MIN_AGE
  return false
}

export function getEligibleSportRankGroups(birthDate: string): SportRankGroup[] {
  const age = getAthleteAgeOnTournamentDate(birthDate)
  if (age == null) {
    return sportRankGroups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => option.id === 'none'),
      }))
      .filter((group) => group.options.length > 0)
  }

  return sportRankGroups
    .map((group) => ({
      ...group,
      options: group.options.filter((option) => isRankAllowedForAge(option.id, age)),
    }))
    .filter((group) => group.options.length > 0)
}

export function sanitizeRankForBirthDate(rankId: string, birthDate: string): SportRankId {
  const age = getAthleteAgeOnTournamentDate(birthDate)
  if (age == null) return 'none'
  const rank = normalizeSportRankId(rankId)
  return isRankAllowedForAge(rank, age) ? rank : 'none'
}

export function validateRankForBirthDate(rankId: string, birthDate: string): string | null {
  const age = getAthleteAgeOnTournamentDate(birthDate)
  if (age == null) return null
  const rank = normalizeSportRankId(rankId)
  if (isRankAllowedForAge(rank, age)) return null

  if (rank.startsWith('child_')) {
    return 'Детские разряды доступны спортсменам младше 12 лет'
  }
  if (rank.startsWith('youth_')) {
    return 'Юношеские разряды доступны с 12 до 17 лет включительно'
  }
  if (rank === 'kms') {
    return 'КМС доступен с 14 лет'
  }
  if (rank.startsWith('adult_')) {
    return 'Взрослые разряды доступны с 18 лет'
  }
  if (rank === 'ms' || rank === 'msmk') {
    return 'Мастер спорта и МСМК доступны с 18 лет'
  }

  return 'Выбранный разряд не подходит по возрасту спортсмена'
}
