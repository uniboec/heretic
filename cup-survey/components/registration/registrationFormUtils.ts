import type { FseWeightCategory } from '@/lib/config/fseCategories'
import {
  getEligibleAgeDivisions,
  getWeightCategoriesForDivision,
} from '@/lib/registration/categoryRules'
import type { AthleteFormRow, DisciplineEntryForm } from './RegistrationForm'

export function sanitizeDisciplineEntries(
  birthDate: string,
  gender: 'male' | 'female' | '',
  entries: DisciplineEntryForm[],
): DisciplineEntryForm[] {
  if (!birthDate || !gender) return entries

  const eligibleDivisionIds = new Set(
    getEligibleAgeDivisions(birthDate, gender).map((division) => division.id),
  )

  return entries.map((entry) => {
    if (!entry.ageDivisionId || !eligibleDivisionIds.has(entry.ageDivisionId)) {
      return { ...entry, ageDivisionId: '', weightCategoryId: '' }
    }

    if (!entry.weightCategoryId) return entry

    const weights = getWeightCategoriesForDivision(entry.ageDivisionId)
    if (weights.some((weight) => weight.id === entry.weightCategoryId)) return entry

    return { ...entry, weightCategoryId: '' }
  })
}

export function getAvailableWeightCategories(
  entries: DisciplineEntryForm[],
  entryIndex: number,
): FseWeightCategory[] {
  const currentEntry = entries[entryIndex]
  if (!currentEntry?.ageDivisionId) return []

  const {
    discipline,
    experienceLevel,
    ageDivisionId,
    weightCategoryId: currentWeightId,
  } = currentEntry
  const usedWeightIds = new Set(
    entries
      .filter((_, i) => i !== entryIndex)
      .filter(
        (entry) =>
          entry.discipline === discipline &&
          entry.experienceLevel === experienceLevel &&
          entry.ageDivisionId === ageDivisionId &&
          Boolean(entry.weightCategoryId),
      )
      .map((entry) => entry.weightCategoryId),
  )

  return getWeightCategoriesForDivision(ageDivisionId).filter(
    (weight) => !usedWeightIds.has(weight.id) || weight.id === currentWeightId,
  )
}

export function isCategoryComplete(entry: DisciplineEntryForm): boolean {
  return Boolean(entry.ageDivisionId && entry.weightCategoryId && entry.experienceLevel)
}

export function isAthletePersonalComplete(athlete: AthleteFormRow): boolean {
  return Boolean(
    athlete.lastName.trim() &&
      athlete.firstName.trim() &&
      athlete.birthDate &&
      athlete.gender &&
      athlete.rank,
  )
}

export function collapseCompleteIndices<T>(
  items: T[],
  isComplete: (item: T) => boolean,
  newIndex: number,
): Set<number> {
  const expanded = new Set<number>()
  expanded.add(newIndex)
  items.forEach((item, index) => {
    if (!isComplete(item)) expanded.add(index)
  })
  return expanded
}
