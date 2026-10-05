import { normalizeSportRankId, type SportRankId } from './ranks'

export type ExperienceLevelId = 'novice' | 'experienced'

const NOVICE_RANK_IDS = new Set<SportRankId>(['none', 'child_3', 'youth_3', 'adult_3'])

export const experienceLevelOptions: Array<{ id: ExperienceLevelId; label: string }> = [
  { id: 'novice', label: 'Новички' },
  { id: 'experienced', label: 'Опытные' },
]

/** Новички: без разряда или III разряд. Опытные: II разряд и выше. */
export function getExperienceLevel(rankId: string | null | undefined): ExperienceLevelId {
  const rank = normalizeSportRankId(rankId)
  return NOVICE_RANK_IDS.has(rank) ? 'novice' : 'experienced'
}

const experienceLevelAliases: Record<string, ExperienceLevelId> = {
  beginner: 'novice',
}

export function getExperienceLevelLabel(id: ExperienceLevelId | string): string {
  const normalized = experienceLevelAliases[id] ?? id
  return experienceLevelOptions.find((option) => option.id === normalized)?.label ?? id
}

export function canRegisterAsNovice(rankId: string | null | undefined): boolean {
  const rank = normalizeSportRankId(rankId)
  return NOVICE_RANK_IDS.has(rank)
}

export function getDefaultExperienceLevel(rankId: string | null | undefined): ExperienceLevelId {
  return getExperienceLevel(rankId)
}

export function isExperienceLevelAllowed(
  rankId: string | null | undefined,
  experienceLevel: ExperienceLevelId,
): boolean {
  if (experienceLevel === 'experienced') return true
  return canRegisterAsNovice(rankId)
}
