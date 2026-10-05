import { disciplineIds, tournamentDisciplines } from '@/lib/config/tournament'
import type { TeamRankingDisciplineFilter, TeamRankingDisciplineOption } from './types'

export const TEAM_RANKING_DISCIPLINE_ALL = 'all' as const

export function isValidTeamRankingDiscipline(value: string): boolean {
  return value === TEAM_RANKING_DISCIPLINE_ALL || disciplineIds.includes(value as (typeof disciplineIds)[number])
}

export function matchesTeamRankingDiscipline(
  categoryDiscipline: string,
  filter: TeamRankingDisciplineFilter,
): boolean {
  if (filter === TEAM_RANKING_DISCIPLINE_ALL) {
    return true
  }
  return categoryDiscipline === filter
}

export function listTeamRankingDisciplineOptions(): TeamRankingDisciplineOption[] {
  return tournamentDisciplines.map((discipline) => ({
    id: discipline.id,
    label: discipline.labelRu,
  }))
}
