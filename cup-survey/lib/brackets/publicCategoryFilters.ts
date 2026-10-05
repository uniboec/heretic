import type { CategoryResult } from './core/types'
import { parseRegistrationCategoryKey } from '@/lib/registration/categoryIdentity'
import {
  bracketCategoryIdentitySortKey,
  compareBracketCategoryKeys,
  comparePublicBracketCategoryGroupKeys,
} from '@/lib/registration/categoryRules'

export type BracketCategoryFilters = {
  discipline: string
  gender: string
  club: string
  experienceLevel: string
  ageDivisionId: string
  weightCategoryId: string
}

export const emptyBracketCategoryFilters: BracketCategoryFilters = {
  discipline: '',
  gender: '',
  club: '',
  experienceLevel: '',
  ageDivisionId: '',
  weightCategoryId: '',
}

export interface BracketCategoryFilterParticipant {
  displayName: string
  clubName: string
  city: string
}

export interface BracketCategoryFilterItem {
  categoryKey: string
  discipline: string
  title: string
  participants: BracketCategoryFilterParticipant[]
  result?: CategoryResult | null
}

export type PublicBracketCompletionMode = 'active' | 'completed' | 'all'

export function isPublicBracketCategoryComplete(
  category: Pick<BracketCategoryFilterItem, 'result'>,
): boolean {
  return category.result?.status === 'complete'
}

export function matchesBracketCompletionMode(
  category: Pick<BracketCategoryFilterItem, 'result'>,
  mode: PublicBracketCompletionMode,
): boolean {
  if (mode === 'all') return true
  const complete = isPublicBracketCategoryComplete(category)
  return mode === 'completed' ? complete : !complete
}

export function countBracketCategoriesByCompletion<T extends Pick<BracketCategoryFilterItem, 'result'>>(
  categories: T[],
): { active: number; completed: number; all: number } {
  let completed = 0
  for (const category of categories) {
    if (isPublicBracketCategoryComplete(category)) completed += 1
  }
  return {
    active: categories.length - completed,
    completed,
    all: categories.length,
  }
}

export function normalizeBracketSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
}

export function genderFromAgeDivisionId(ageDivisionId: string): 'male' | 'female' {
  return ageDivisionId.startsWith('f_') ? 'female' : 'male'
}

export function categorySearchHaystack(category: BracketCategoryFilterItem): string {
  const participantBits = category.participants.flatMap((participant) => [
    participant.displayName,
    participant.clubName,
    participant.city,
  ])
  return normalizeBracketSearchText([category.title, ...participantBits].filter(Boolean).join(' '))
}

export function participantTextMatchesQuery(
  participant: BracketCategoryFilterParticipant,
  query: string,
): boolean {
  const normalizedQuery = normalizeBracketSearchText(query)
  if (!normalizedQuery) return true

  for (const field of [participant.displayName, participant.clubName, participant.city]) {
    const normalizedField = normalizeBracketSearchText(field)
    if (!normalizedField) continue
    if (normalizedField.includes(normalizedQuery)) return true

    const words = normalizedField.split(' ')
    if (words.some((word) => word.startsWith(normalizedQuery) || word.includes(normalizedQuery))) {
      return true
    }
  }

  return false
}

export function categoryMatchesSearchQuery(
  category: BracketCategoryFilterItem,
  searchQuery: string,
): boolean {
  const normalizedQuery = normalizeBracketSearchText(searchQuery)
  if (!normalizedQuery) return true

  if (normalizeBracketSearchText(category.title).includes(normalizedQuery)) return true

  return category.participants.some((participant) =>
    participantTextMatchesQuery(participant, normalizedQuery),
  )
}

export function categoryMatchesClub(category: BracketCategoryFilterItem, clubQuery: string): boolean {
  const query = normalizeBracketSearchText(clubQuery)
  if (!query) return true
  return category.participants.some(
    (participant) =>
      normalizeBracketSearchText(participant.clubName).includes(query) ||
      normalizeBracketSearchText(participant.city).includes(query),
  )
}

export function matchesBracketCategoryFilters(
  category: BracketCategoryFilterItem,
  filters: BracketCategoryFilters,
  searchQuery = '',
): boolean {
  if (!categoryMatchesSearchQuery(category, searchQuery)) return false

  const identity = parseRegistrationCategoryKey(category.categoryKey)
  if (!identity) return true

  if (filters.discipline && category.discipline !== filters.discipline) return false
  if (filters.experienceLevel && identity.experienceLevel !== filters.experienceLevel) return false
  if (filters.ageDivisionId && identity.ageDivisionId !== filters.ageDivisionId) return false
  if (filters.weightCategoryId && identity.weightCategoryId !== filters.weightCategoryId) return false

  if (filters.gender) {
    const gender = genderFromAgeDivisionId(identity.ageDivisionId)
    if (gender !== filters.gender) return false
  }

  if (!categoryMatchesClub(category, filters.club ?? '')) return false

  return true
}

export function countActiveBracketFilters(filters: BracketCategoryFilters): number {
  return Object.values(filters).filter(Boolean).length
}

export function bracketCategorySortKey(category: BracketCategoryFilterItem): string {
  return bracketCategoryIdentitySortKey(category.categoryKey)
}

export { compareBracketCategoryKeys }

export function compareBracketCategories(
  left: BracketCategoryFilterItem,
  right: BracketCategoryFilterItem,
): number {
  return comparePublicBracketCategoryGroupKeys(
    bracketCategorySortKey(left),
    bracketCategorySortKey(right),
  )
}

/** Public brackets: discipline → age → weight → level (novice, then experienced). */
export function sortBracketCategories<T extends BracketCategoryFilterItem>(categories: T[]): T[] {
  return [...categories].sort(compareBracketCategories)
}
