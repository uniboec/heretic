import type { AthleteRatingRankedRow } from './types'

export function applyPublicTopLimit(
  rows: AthleteRatingRankedRow[],
  topLimit: number,
): AthleteRatingRankedRow[] {
  const eligible = rows.filter((row) => !row.unranked && row.rank != null)
  if (eligible.length === 0 || topLimit <= 0) {
    return []
  }

  const base = eligible.slice(0, topLimit)
  const last = base[base.length - 1]
  if (!last || last.rank == null) {
    return base
  }

  const extras = eligible.slice(topLimit).filter((row) => row.rank === last.rank)
  return [...base, ...extras]
}
