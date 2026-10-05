import { tournamentInfo, CHILD_AGE_UP_MAX_AGE } from '../config/tournament'
import {
  type FseAgeDivision,
  type FseWeightCategory,
  fseAgeDivisions,
  getAgeDivision,
  getCompetitionCategoryLabel,
  getWeightCategory,
} from '../config/fseCategories'
import { disciplineIds } from '../config/tournament'
import type { ExperienceLevelId } from '../config/experienceLevel'
import { experienceLevelOptions, getExperienceLevelLabel } from '../config/experienceLevel'
import { parseRegistrationCategoryKey } from './categoryIdentity'

export type TargetCategoryValidationError = {
  code: 'INVALID_TARGET_CATEGORY' | 'GENDER_MISMATCH'
  message: string
}

function parseIsoDateParts(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

function toBirthDateIso(birthDate: Date | string): string {
  if (typeof birthDate === 'string') return birthDate
  return birthDate.toISOString().slice(0, 10)
}

/** Возраст на дату соревнований (календарный расчёт, без сдвига часового пояса). */
export function getAgeOnEventDate(
  birthDate: Date | string,
  eventDate: string = tournamentInfo.eventDate,
): number {
  const birth = parseIsoDateParts(toBirthDateIso(birthDate))
  const event = parseIsoDateParts(eventDate)
  let age = event.year - birth.year
  if (event.month < birth.month || (event.month === birth.month && event.day < birth.day)) {
    age -= 1
  }
  return age
}

/** @deprecated используйте getAgeOnEventDate */
export function getAgeOnReferenceDate(birthDate: Date, referenceDate = tournamentInfo.eventDate): number {
  return getAgeOnEventDate(birthDate, referenceDate)
}

export function getAthleteAgeOnTournamentDate(birthDate: string | Date): number | null {
  const iso = toBirthDateIso(birthDate)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  return getAgeOnEventDate(iso)
}

export function isAgeEligibleForDivision(age: number, division: FseAgeDivision): boolean {
  if (age < division.ageMin) return false
  if (division.ageMax != null && age > division.ageMax) return false
  return true
}

function getGenderDivisionLadder(gender: 'male' | 'female'): FseAgeDivision[] {
  return fseAgeDivisions.filter((d) => d.gender === gender)
}

export function getNaturalAgeDivisions(
  birthDate: Date | string,
  gender: 'male' | 'female',
): FseAgeDivision[] {
  const age = getAgeOnEventDate(birthDate)
  return getGenderDivisionLadder(gender).filter((d) => isAgeEligibleForDivision(age, d))
}

export function canRegisterInHigherAgeDivision(age: number): boolean {
  return age <= CHILD_AGE_UP_MAX_AGE
}

export function getNextAgeDivision(
  divisionId: string,
  gender: 'male' | 'female',
): FseAgeDivision | null {
  const ladder = getGenderDivisionLadder(gender)
  const index = ladder.findIndex((d) => d.id === divisionId)
  if (index < 0 || index >= ladder.length - 1) return null
  return ladder[index + 1]
}

export function isAgeUpDivision(
  birthDate: Date | string,
  gender: 'male' | 'female',
  ageDivisionId: string,
): boolean {
  const natural = getNaturalAgeDivisions(birthDate, gender)
  if (natural.some((d) => d.id === ageDivisionId)) return false
  const age = getAgeOnEventDate(birthDate)
  if (!canRegisterInHigherAgeDivision(age)) return false

  return natural.some((d) => getNextAgeDivision(d.id, gender)?.id === ageDivisionId)
}

export function getEligibleAgeDivisions(
  birthDate: Date | string,
  gender: 'male' | 'female',
): FseAgeDivision[] {
  const ladder = getGenderDivisionLadder(gender)
  const natural = getNaturalAgeDivisions(birthDate, gender)
  const age = getAgeOnEventDate(birthDate)

  const ids = new Set(natural.map((d) => d.id))

  if (canRegisterInHigherAgeDivision(age)) {
    for (const division of natural) {
      const next = getNextAgeDivision(division.id, gender)
      if (next) ids.add(next.id)
    }
  }

  return ladder.filter((d) => ids.has(d.id))
}

export function getWeightCategoriesForDivision(ageDivisionId: string): FseWeightCategory[] {
  return getAgeDivision(ageDivisionId)?.weightCategories ?? []
}

function isWeightCategoryValidForDivision(ageDivisionId: string, weightCategoryId: string): boolean {
  const weights = getWeightCategoriesForDivision(ageDivisionId)
  if (weights.some((weight) => weight.id === weightCategoryId)) return true

  const legacyMatch = weightCategoryId.match(/^w_(\d+\+?)$/)
  if (!legacyMatch) return false

  const legacyValue = legacyMatch[1]
  const canonicalCandidates = [
    `${ageDivisionId}_w_le_${legacyValue}`,
    `${ageDivisionId}_w_gt_${legacyValue.replace('+', '')}`,
  ]
  return canonicalCandidates.some((candidate) => weights.some((weight) => weight.id === candidate))
}

export function athleteCategorySelectionKey(entry: {
  discipline: string
  experienceLevel: string
  ageDivisionId: string
  weightCategoryId: string
}): string {
  return `${entry.discipline}:${entry.experienceLevel}:${entry.ageDivisionId}:${entry.weightCategoryId}`
}

const experienceLevelAliases: Record<string, ExperienceLevelId> = {
  beginner: 'novice',
}

export function normalizeExperienceLevelForSort(id: string): string {
  return experienceLevelAliases[id] ?? id
}

function normalizeExperienceLevelId(id: string): ExperienceLevelId | null {
  const normalized = normalizeExperienceLevelForSort(id)
  return experienceLevelOptions.some((option) => option.id === normalized)
    ? (normalized as ExperienceLevelId)
    : null
}

function genderFromAgeDivisionId(ageDivisionId: string): 'male' | 'female' {
  return ageDivisionId.startsWith('f_') ? 'female' : 'male'
}

/** Structural validation for admin move target — no birthDate eligibility. */
export function validateTargetCategoryStructure(
  categoryKey: string,
  athleteGender: 'male' | 'female',
): TargetCategoryValidationError | null {
  const identity = parseRegistrationCategoryKey(categoryKey)
  if (!identity) {
    return {
      code: 'INVALID_TARGET_CATEGORY',
      message: 'Некорректный ключ категории',
    }
  }

  if (!(disciplineIds as readonly string[]).includes(identity.discipline)) {
    return {
      code: 'INVALID_TARGET_CATEGORY',
      message: 'Дисциплина не найдена в турнире',
    }
  }

  if (!normalizeExperienceLevelId(identity.experienceLevel)) {
    return {
      code: 'INVALID_TARGET_CATEGORY',
      message: 'Недопустимый уровень категории',
    }
  }

  const ageDivision = getAgeDivision(identity.ageDivisionId)
  if (!ageDivision) {
    return {
      code: 'INVALID_TARGET_CATEGORY',
      message: 'Возрастная категория не найдена',
    }
  }

  const targetGender = genderFromAgeDivisionId(identity.ageDivisionId)
  if (targetGender !== athleteGender) {
    return {
      code: 'GENDER_MISMATCH',
      message: 'Целевая категория не соответствует полу спортсмена',
    }
  }

  const weights = getWeightCategoriesForDivision(identity.ageDivisionId)
  if (!isWeightCategoryValidForDivision(identity.ageDivisionId, identity.weightCategoryId)) {
    return {
      code: 'INVALID_TARGET_CATEGORY',
      message: 'Весовая категория не подходит для возрастной группы',
    }
  }

  return null
}

export function validateCategorySelection(input: {
  birthDate: string
  gender: 'male' | 'female'
  ageDivisionId: string
  weightCategoryId: string
}): string | null {
  const eligible = getEligibleAgeDivisions(input.birthDate, input.gender)
  if (!eligible.some((d) => d.id === input.ageDivisionId)) {
    const age = getAgeOnEventDate(input.birthDate)
    if (canRegisterInHigherAgeDivision(age)) {
      return 'Выбранная возрастная категория не подходит спортсмену (доступна своя группа или одна старше)'
    }
    return 'Выбранная возрастная категория не подходит спортсмену'
  }
  const weights = getWeightCategoriesForDivision(input.ageDivisionId)
  if (!weights.some((w) => w.id === input.weightCategoryId)) {
    return 'Выбранная весовая категория не подходит для возрастной группы'
  }
  return null
}

export function weightCategoryToDeclaredKg(weightCategoryId: string): number | null {
  const category = getWeightCategory(weightCategoryId)
  if (!category) return null
  if (category.maxWeight != null) return category.maxWeight
  if (category.minWeight != null) return category.minWeight
  return null
}

export function getTournamentCategoryLabel(
  ageDivisionId: string,
  weightCategoryId: string,
  experienceLevel: ExperienceLevelId,
): string {
  const level = getExperienceLevelLabel(experienceLevel)
  const base = getCompetitionCategoryLabel(ageDivisionId, weightCategoryId)
  return `${level} · ${base}`
}

const disciplineSortOrder: Record<string, number> = {
  tactic_control: 0,
  close_control: 1,
}

const experienceLevelSortOrder: Record<string, number> = {
  novice: 0,
  experienced: 1,
}

const ageDivisionSortIndex = new Map(fseAgeDivisions.map((division, index) => [division.id, index]))

function getWeightCategorySortIndex(ageDivisionId: string, weightCategoryId: string): number {
  const division = getAgeDivision(ageDivisionId)
  if (!division) return Number.MAX_SAFE_INTEGER
  const index = division.weightCategories.findIndex((weight) => weight.id === weightCategoryId)
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER
}

/** Порядок групп категорий: дисциплина → уровень → возраст → вес. */
export function compareTournamentCategoryGroupKeys(a: string, b: string): number {
  const [disciplineA, experienceA, ageDivisionA, weightCategoryA] = a.split('|')
  const [disciplineB, experienceB, ageDivisionB, weightCategoryB] = b.split('|')

  const disciplineDiff =
    (disciplineSortOrder[disciplineA] ?? 99) - (disciplineSortOrder[disciplineB] ?? 99)
  if (disciplineDiff !== 0) return disciplineDiff

  const experienceDiff =
    (experienceLevelSortOrder[normalizeExperienceLevelForSort(experienceA)] ?? 99) -
    (experienceLevelSortOrder[normalizeExperienceLevelForSort(experienceB)] ?? 99)
  if (experienceDiff !== 0) return experienceDiff

  const ageDiff =
    (ageDivisionSortIndex.get(ageDivisionA) ?? 999) - (ageDivisionSortIndex.get(ageDivisionB) ?? 999)
  if (ageDiff !== 0) return ageDiff

  return (
    getWeightCategorySortIndex(ageDivisionA, weightCategoryA) -
    getWeightCategorySortIndex(ageDivisionB, weightCategoryB)
  )
}

export function bracketCategoryIdentitySortKey(categoryKey: string): string {
  const identity = parseRegistrationCategoryKey(categoryKey)
  if (!identity) return categoryKey
  return `${identity.discipline}|${identity.ageDivisionId}|${identity.weightCategoryId}|${normalizeExperienceLevelForSort(identity.experienceLevel)}`
}

/** Очередь поединков на ковре: возраст → вес → уровень → дисциплина. */
export function compareBoutScheduleCategoryKeys(leftKey: string, rightKey: string): number {
  const left = parseRegistrationCategoryKey(leftKey)
  const right = parseRegistrationCategoryKey(rightKey)
  if (!left || !right) return leftKey.localeCompare(rightKey)

  const ageDiff =
    (ageDivisionSortIndex.get(left.ageDivisionId) ?? 999) -
    (ageDivisionSortIndex.get(right.ageDivisionId) ?? 999)
  if (ageDiff !== 0) return ageDiff

  const weightDiff =
    getWeightCategorySortIndex(left.ageDivisionId, left.weightCategoryId) -
    getWeightCategorySortIndex(right.ageDivisionId, right.weightCategoryId)
  if (weightDiff !== 0) return weightDiff

  const experienceDiff =
    (experienceLevelSortOrder[normalizeExperienceLevelForSort(left.experienceLevel)] ?? 99) -
    (experienceLevelSortOrder[normalizeExperienceLevelForSort(right.experienceLevel)] ?? 99)
  if (experienceDiff !== 0) return experienceDiff

  return (
    (disciplineSortOrder[left.discipline] ?? 99) - (disciplineSortOrder[right.discipline] ?? 99)
  )
}

/** Единый порядок категорий сеток: дисциплина → возраст → вес → уровень. */
export function compareBracketCategoryKeys(leftKey: string, rightKey: string): number {
  return comparePublicBracketCategoryGroupKeys(
    bracketCategoryIdentitySortKey(leftKey),
    bracketCategoryIdentitySortKey(rightKey),
  )
}

/** Публичные сетки: дисциплина → возраст → вес → уровень (новички → опытные). */
export function comparePublicBracketCategoryGroupKeys(a: string, b: string): number {
  const [disciplineA, ageDivisionA, weightCategoryA, experienceA] = a.split('|')
  const [disciplineB, ageDivisionB, weightCategoryB, experienceB] = b.split('|')

  const disciplineDiff =
    (disciplineSortOrder[disciplineA] ?? 99) - (disciplineSortOrder[disciplineB] ?? 99)
  if (disciplineDiff !== 0) return disciplineDiff

  const ageDiff =
    (ageDivisionSortIndex.get(ageDivisionA) ?? 999) - (ageDivisionSortIndex.get(ageDivisionB) ?? 999)
  if (ageDiff !== 0) return ageDiff

  const weightDiff =
    getWeightCategorySortIndex(ageDivisionA, weightCategoryA) -
    getWeightCategorySortIndex(ageDivisionB, weightCategoryB)
  if (weightDiff !== 0) return weightDiff

  return (
    (experienceLevelSortOrder[normalizeExperienceLevelForSort(experienceA)] ?? 99) -
    (experienceLevelSortOrder[normalizeExperienceLevelForSort(experienceB)] ?? 99)
  )
}

export { getCompetitionCategoryLabel }
