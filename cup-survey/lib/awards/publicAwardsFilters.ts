import { parseRegistrationCategoryKey } from '@/lib/registration/categoryIdentity'
import {
  categoryMatchesSearchQuery,
  matchesBracketCategoryFilters,
  normalizeBracketSearchText,
  sortBracketCategories,
  type BracketCategoryFilterItem,
  type BracketCategoryFilters,
} from '@/lib/brackets/publicCategoryFilters'
import type { PublicAwardPlacement, PublicAwardsResponse } from './dto/public'

type AwardCategoryLike = {
  categoryKey: string
  categoryTitle: string
  placements: PublicAwardPlacement[]
}

function toFilterItem(category: AwardCategoryLike): BracketCategoryFilterItem {
  const identity = parseRegistrationCategoryKey(category.categoryKey)
  return {
    categoryKey: category.categoryKey,
    discipline: identity?.discipline ?? '',
    title: category.categoryTitle,
    participants: category.placements.map((placement) => ({
      displayName: placement.displayName,
      clubName: placement.clubName,
      city: '',
    })),
  }
}

function placementMatchesSearch(placement: PublicAwardPlacement, searchQuery: string): boolean {
  const normalizedQuery = normalizeBracketSearchText(searchQuery)
  if (!normalizedQuery) return true

  const haystack = normalizeBracketSearchText(
    [placement.displayName, placement.clubName, placement.publicComment ?? ''].filter(Boolean).join(' '),
  )
  if (haystack.includes(normalizedQuery)) return true

  return haystack
    .split(' ')
    .some((word) => word.startsWith(normalizedQuery) || word.includes(normalizedQuery))
}

export function buildAwardsFilterCategories(data: PublicAwardsResponse): BracketCategoryFilterItem[] {
  const byKey = new Map<string, BracketCategoryFilterItem>()

  for (const source of [...data.queue, ...data.completed]) {
    const existing = byKey.get(source.categoryKey)
    if (existing) {
      const seen = new Set(
        existing.participants.map((participant) => `${participant.displayName}::${participant.clubName}`),
      )
      for (const placement of source.placements) {
        const key = `${placement.displayName}::${placement.clubName}`
        if (seen.has(key)) continue
        seen.add(key)
        existing.participants.push({
          displayName: placement.displayName,
          clubName: placement.clubName,
          city: '',
        })
      }
      continue
    }

    const identity = parseRegistrationCategoryKey(source.categoryKey)
    byKey.set(source.categoryKey, {
      categoryKey: source.categoryKey,
      discipline: identity?.discipline ?? '',
      title: source.categoryTitle,
      participants: source.placements.map((placement) => ({
        displayName: placement.displayName,
        clubName: placement.clubName,
        city: '',
      })),
    })
  }

  return sortBracketCategories([...byKey.values()])
}

export function filterAwardCategory<T extends AwardCategoryLike>(
  category: T,
  filters: BracketCategoryFilters,
  searchQuery = '',
): T | null {
  const filterItem = toFilterItem(category)
  if (!matchesBracketCategoryFilters(filterItem, filters, '')) return null

  const normalizedSearch = normalizeBracketSearchText(searchQuery)
  if (!normalizedSearch) return category

  if (categoryMatchesSearchQuery(filterItem, searchQuery)) {
    return category
  }

  const placements = category.placements.filter((placement) =>
    placementMatchesSearch(placement, searchQuery),
  )
  if (placements.length === 0) return null

  return { ...category, placements }
}

export function filterAwardCategories<T extends AwardCategoryLike>(
  categories: T[],
  filters: BracketCategoryFilters,
  searchQuery = '',
): T[] {
  return categories
    .map((category) => filterAwardCategory(category, filters, searchQuery))
    .filter((category): category is T => category !== null)
}

export function countFilteredAwardPlacements(
  categories: AwardCategoryLike[],
  filters: BracketCategoryFilters,
  searchQuery = '',
): number {
  return filterAwardCategories(categories, filters, searchQuery).reduce(
    (sum, category) => sum + category.placements.length,
    0,
  )
}

export function hasActivePublicAwardsFilters(
  filters: BracketCategoryFilters,
  searchQuery = '',
): boolean {
  return searchQuery.trim().length > 0 || Object.values(filters).some(Boolean)
}
