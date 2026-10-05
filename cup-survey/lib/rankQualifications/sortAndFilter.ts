import { getStrengthTier } from '@/lib/brackets/core/seeding/strengthTier'
import type { SportRankId } from '@/lib/config/ranks'
import { formatNormRankLabel } from './formatResultLabel'
import type { NormQualificationsPublicRow } from './types'

export type NormQualificationDisciplineFilter = 'all' | 'tactic_control' | 'close_control'
export type NormQualificationRankFilter = 'all' | SportRankId

export function compareNormQualificationRows(
  a: NormQualificationsPublicRow,
  b: NormQualificationsPublicRow,
): number {
  const tierA = getStrengthTier(a.achievedNormRank) ?? -1
  const tierB = getStrengthTier(b.achievedNormRank) ?? -1
  if (tierA !== tierB) return tierB - tierA

  const nameCmp = a.athleteName.localeCompare(b.athleteName, 'ru')
  if (nameCmp !== 0) return nameCmp

  return a.disciplineLabel.localeCompare(b.disciplineLabel, 'ru')
}

export function sortNormQualificationRows(
  rows: readonly NormQualificationsPublicRow[],
): NormQualificationsPublicRow[] {
  return [...rows].sort(compareNormQualificationRows)
}

export function listAvailableNormRanks(
  rows: readonly NormQualificationsPublicRow[],
): SportRankId[] {
  const rankIds = new Set(rows.map((row) => row.achievedNormRank))
  return [...rankIds].sort((a, b) => {
    const tierA = getStrengthTier(a) ?? -1
    const tierB = getStrengthTier(b) ?? -1
    return tierB - tierA
  })
}

export function filterNormQualificationRows(input: {
  rows: readonly NormQualificationsPublicRow[]
  discipline: NormQualificationDisciplineFilter
  rank: NormQualificationRankFilter
  search: string
}): NormQualificationsPublicRow[] {
  const query = input.search.trim().toLowerCase()

  return sortNormQualificationRows(
    input.rows.filter((row) => {
      if (input.discipline !== 'all' && row.discipline !== input.discipline) {
        return false
      }
      if (input.rank !== 'all' && row.achievedNormRank !== input.rank) {
        return false
      }
      if (!query) return true

      const haystack = [row.athleteName, row.clubName, row.city]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    }),
  )
}

export function formatNormRankFilterLabel(rankId: SportRankId): string {
  return formatNormRankLabel(rankId)
}
