import type { AthleteRatingView } from './constants'
import type { AthleteRatingTieBreakMetrics } from './types'

export function compareTieBreakMetrics(
  left: AthleteRatingTieBreakMetrics,
  right: AthleteRatingTieBreakMetrics,
  view: AthleteRatingView,
): number {
  if (right.countableWins !== left.countableWins) {
    return right.countableWins - left.countableWins
  }
  if (right.submissionChokeWins !== left.submissionChokeWins) {
    return right.submissionChokeWins - left.submissionChokeWins
  }
  if (right.firstPlaces !== left.firstPlaces) {
    return right.firstPlaces - left.firstPlaces
  }
  if (right.secondPlaces !== left.secondPlaces) {
    return right.secondPlaces - left.secondPlaces
  }
  if (right.thirdPlaces !== left.thirdPlaces) {
    return right.thirdPlaces - left.thirdPlaces
  }
  if (view === 'overall') {
    if (right.bestSingleDisciplineHundredths !== left.bestSingleDisciplineHundredths) {
      return right.bestSingleDisciplineHundredths - left.bestSingleDisciplineHundredths
    }
  }
  return 0
}

export function hasSameTieBreakMetrics(
  left: AthleteRatingTieBreakMetrics,
  right: AthleteRatingTieBreakMetrics,
  view: AthleteRatingView,
): boolean {
  return compareTieBreakMetrics(left, right, view) === 0
}

export function assignRanks<T extends { viewRatingHundredths: number; tieBreak: AthleteRatingTieBreakMetrics }>(
  sortedRows: T[],
  view: AthleteRatingView,
): Array<T & { rank: number | null; unranked: boolean }> {
  const ranked: Array<T & { rank: number | null; unranked: boolean }> = []

  for (let index = 0; index < sortedRows.length; index += 1) {
    const current = sortedRows[index]
    if (current.viewRatingHundredths <= 0) {
      ranked.push({ ...current, rank: null, unranked: true })
      continue
    }

    if (index === 0) {
      ranked.push({ ...current, rank: 1, unranked: false })
      continue
    }

    const previous = sortedRows[index - 1]
    const sameRating = previous.viewRatingHundredths === current.viewRatingHundredths
    const sameTieBreak =
      sameRating && hasSameTieBreakMetrics(previous.tieBreak, current.tieBreak, view)

    ranked.push({
      ...current,
      rank:
        sameRating && sameTieBreak
          ? (ranked[index - 1]?.rank ?? index + 1)
          : index + 1,
      unranked: false,
    })
  }

  return ranked
}
