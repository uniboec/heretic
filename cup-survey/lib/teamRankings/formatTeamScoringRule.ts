import type { TeamRankingPointSettings } from './types'

export function formatTeamScoringRule(pointSettings: TeamRankingPointSettings): string {
  const base = `1 место — ${pointSettings.first}, 2 место — ${pointSettings.second}, 3 место — ${pointSettings.third} балла`

  switch (pointSettings.soloParticipant.mode) {
    case 'EXCLUDE':
      return `${base}. Одиночные категории (без боёв) не дают командных баллов.`
    case 'CUSTOM':
      return `${base}. Одиночные категории — ${pointSettings.soloParticipant.points ?? 0} балла.`
    case 'STANDARD':
    default:
      return `${base}.`
  }
}
