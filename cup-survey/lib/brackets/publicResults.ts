import { parseRegistrationCategoryKey } from '@/lib/registration/categoryIdentity'
import type { CategoryPlacement, CategoryResult } from './core/types'
import {
  compareBracketCategories,
  genderFromAgeDivisionId,
  normalizeBracketSearchText,
  sortBracketCategories,
  type BracketCategoryFilterItem,
  type BracketCategoryFilters,
} from './publicCategoryFilters'

export type CategoryGender = ReturnType<typeof genderFromAgeDivisionId>

export type PublicResultCategoryFilterData = {
  discipline: string
  experienceLevel: string
  ageDivisionId: string
  weightCategoryId: string
  gender: CategoryGender
}

export type PublicResultRow = {
  rowKey: string
  entryId: string
  displayName: string
  clubName: string
  city: string
  placement: number
  provisional: boolean
  categoryKey: string
  categoryTitle: string
  category: PublicResultCategoryFilterData
  placementIndex: number
}

export type PublicResultsStats = {
  medalists: number
  categoriesWithResults: number
}

export type PublicResultsResponse = {
  published: boolean
  publishedAt: string | null
  rows: PublicResultRow[]
  filterCategories: BracketCategoryFilterItem[]
  stats: PublicResultsStats
}

export type PublicResultCategorySource = {
  categoryKey: string
  discipline: string
  title: string
  participants: Array<{
    entryId: string
    displayName: string
    clubName: string
    city: string
  }>
  result: CategoryResult | null | undefined
}

export type PublicResultFilterCategorySource = {
  categoryKey: string
  discipline: string
  title: string
  participants: Array<{
    displayName: string
    clubName: string
    city: string
  }>
}

export function buildPublicResultRowKey(
  categoryKey: string,
  placementIndex: number,
  entryId: string,
): string {
  return `${categoryKey}:${placementIndex}:${entryId}`
}

export function buildCategoryFilterData(categoryKey: string): PublicResultCategoryFilterData | null {
  const identity = parseRegistrationCategoryKey(categoryKey)
  if (!identity) return null

  return {
    discipline: identity.discipline,
    experienceLevel: identity.experienceLevel,
    ageDivisionId: identity.ageDivisionId,
    weightCategoryId: identity.weightCategoryId,
    gender: genderFromAgeDivisionId(identity.ageDivisionId),
  }
}

export function buildFilterCategories(
  sources: PublicResultFilterCategorySource[],
): BracketCategoryFilterItem[] {
  return sortBracketCategories(
    sources.map((source) => ({
      categoryKey: source.categoryKey,
      discipline: source.discipline,
      title: source.title,
      participants: source.participants.map((participant) => ({
        displayName: participant.displayName,
        clubName: participant.clubName,
        city: participant.city,
      })),
    })),
  )
}

function resolveParticipant(
  participants: PublicResultCategorySource['participants'],
  entryId: string,
): PublicResultCategorySource['participants'][number] | undefined {
  return participants.find((participant) => participant.entryId === entryId)
}

function comparePublicResultRows(left: PublicResultRow, right: PublicResultRow): number {
  const categoryCompare = compareBracketCategories(
    {
      categoryKey: left.categoryKey,
      discipline: left.category.discipline,
      title: left.categoryTitle,
      participants: [],
    },
    {
      categoryKey: right.categoryKey,
      discipline: right.category.discipline,
      title: right.categoryTitle,
      participants: [],
    },
  )
  if (categoryCompare !== 0) return categoryCompare

  if (left.placement !== right.placement) return left.placement - right.placement
  if (left.placementIndex !== right.placementIndex) return left.placementIndex - right.placementIndex

  return left.displayName.localeCompare(right.displayName, 'ru')
}

export function buildPublicResultRows(sources: PublicResultCategorySource[]): PublicResultRow[] {
  const rows: PublicResultRow[] = []

  for (const source of sources) {
    const placements = source.result?.placements ?? []
    if (placements.length === 0) continue

    const category = buildCategoryFilterData(source.categoryKey)
    if (!category) continue

    placements.forEach((placement: CategoryPlacement, placementIndex: number) => {
      const participant = resolveParticipant(source.participants, placement.entryId)

      rows.push({
        rowKey: buildPublicResultRowKey(source.categoryKey, placementIndex, placement.entryId),
        entryId: placement.entryId,
        displayName: participant?.displayName ?? placement.entryId,
        clubName: participant?.clubName ?? '',
        city: participant?.city ?? '',
        placement: placement.placement,
        provisional: placement.provisional ?? false,
        categoryKey: source.categoryKey,
        categoryTitle: source.title,
        category,
        placementIndex,
      })
    })
  }

  return rows.sort(comparePublicResultRows)
}

export function buildPublicResultsStats(rows: PublicResultRow[]): PublicResultsStats {
  return {
    medalists: rows.length,
    categoriesWithResults: new Set(rows.map((row) => row.categoryKey)).size,
  }
}

function rowTextMatchesQuery(row: PublicResultRow, searchQuery: string): boolean {
  const normalizedQuery = normalizeBracketSearchText(searchQuery)
  if (!normalizedQuery) return true

  const haystack = normalizeBracketSearchText(
    [row.displayName, row.clubName, row.city, row.categoryTitle].filter(Boolean).join(' '),
  )
  if (haystack.includes(normalizedQuery)) return true

  return haystack
    .split(' ')
    .some((word) => word.startsWith(normalizedQuery) || word.includes(normalizedQuery))
}

function rowMatchesClubFilter(row: PublicResultRow, clubQuery: string): boolean {
  const query = normalizeBracketSearchText(clubQuery)
  if (!query) return true

  return (
    normalizeBracketSearchText(row.clubName).includes(query) ||
    normalizeBracketSearchText(row.city).includes(query)
  )
}

export function matchesPublicResultRow(
  row: PublicResultRow,
  filters: BracketCategoryFilters,
  searchQuery = '',
): boolean {
  if (!rowTextMatchesQuery(row, searchQuery)) return false

  if (filters.discipline && row.category.discipline !== filters.discipline) return false
  if (filters.experienceLevel && row.category.experienceLevel !== filters.experienceLevel) {
    return false
  }
  if (filters.ageDivisionId && row.category.ageDivisionId !== filters.ageDivisionId) return false
  if (filters.weightCategoryId && row.category.weightCategoryId !== filters.weightCategoryId) {
    return false
  }
  if (filters.gender && row.category.gender !== filters.gender) return false
  if (!rowMatchesClubFilter(row, filters.club ?? '')) return false

  return true
}

export function hasActivePublicResultFilters(
  filters: BracketCategoryFilters,
  searchQuery = '',
): boolean {
  return searchQuery.trim().length > 0 || Object.values(filters).some(Boolean)
}
