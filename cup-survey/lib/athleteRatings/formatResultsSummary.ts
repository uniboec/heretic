import {
  DISCIPLINE_SHORT_LABELS,
  type AthleteRatingDiscipline,
  type AthleteRatingView,
} from './constants'
import type { AthleteRatingDisciplineResult } from './types'

const MEDAL_BY_PLACEMENT: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
}

function formatDisciplineMedals(
  discipline: AthleteRatingDiscipline,
  result: AthleteRatingDisciplineResult | null,
): string[] {
  if (!result?.placements.length) {
    return []
  }

  return result.placements
    .filter((placement) => placement >= 1 && placement <= 3)
    .map((placement) => {
      const medal = MEDAL_BY_PLACEMENT[placement]
      if (!medal) return null
      return `${medal} ${DISCIPLINE_SHORT_LABELS[discipline]}`
    })
    .filter((part): part is string => part != null)
}

export function formatResultsSummaryForView(
  view: AthleteRatingView,
  tacticControl: AthleteRatingDisciplineResult | null,
  closeControl: AthleteRatingDisciplineResult | null,
): string {
  if (view === 'tactic_control') {
    const medals = formatDisciplineMedals('tactic_control', tacticControl)
    return medals.length > 0 ? medals.join(' · ') : '—'
  }
  if (view === 'close_control') {
    const medals = formatDisciplineMedals('close_control', closeControl)
    return medals.length > 0 ? medals.join(' · ') : '—'
  }

  const parts = [
    ...formatDisciplineMedals('tactic_control', tacticControl),
    ...formatDisciplineMedals('close_control', closeControl),
  ]

  return parts.length > 0 ? parts.join(' · ') : '—'
}

function formatDisciplinePlacement(
  discipline: AthleteRatingDiscipline,
  result: AthleteRatingDisciplineResult | null,
): string | null {
  if (!result?.placements.length) return null
  const placementLabels = result.placements.map((placement) => String(placement)).join(', ')
  return `${DISCIPLINE_SHORT_LABELS[discipline]}: ${placementLabels}`
}

export function formatPlacementSummaryForView(
  view: AthleteRatingView,
  tacticControl: AthleteRatingDisciplineResult | null,
  closeControl: AthleteRatingDisciplineResult | null,
): string {
  if (view === 'tactic_control') {
    return formatDisciplinePlacement('tactic_control', tacticControl) ?? '—'
  }
  if (view === 'close_control') {
    return formatDisciplinePlacement('close_control', closeControl) ?? '—'
  }

  const parts = [
    formatDisciplinePlacement('tactic_control', tacticControl),
    formatDisciplinePlacement('close_control', closeControl),
  ].filter((part): part is string => part != null)

  return parts.length > 0 ? parts.join(' · ') : '—'
}
