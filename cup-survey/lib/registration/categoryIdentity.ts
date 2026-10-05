import { getDisciplineShortLabel } from '../config/tournament'
import type { ExperienceLevelId } from '../config/experienceLevel'
import { getTournamentCategoryLabel } from './categoryRules'

export interface RegistrationCategoryIdentity {
  discipline: string
  experienceLevel: ExperienceLevelId | string
  ageDivisionId: string
  weightCategoryId: string
}

export interface CategoryIdentityAthlete {
  gender: string
}

export interface CategoryIdentityEntry {
  discipline: string
  experienceLevel: ExperienceLevelId | string
  ageDivisionId: string | null
  weightCategoryId: string | null
}

/** ageDivisionId is gender-specific (m_/f_ prefix) — separate gender field not needed in key. */
export function getRegistrationCategoryIdentity(
  entry: CategoryIdentityEntry,
  athlete: CategoryIdentityAthlete,
): RegistrationCategoryIdentity | null {
  if (!entry.ageDivisionId || !entry.weightCategoryId) return null
  assertAgeDivisionMatchesGender(entry.ageDivisionId, athlete.gender)
  return {
    discipline: entry.discipline,
    experienceLevel: entry.experienceLevel,
    ageDivisionId: entry.ageDivisionId,
    weightCategoryId: entry.weightCategoryId,
  }
}

export function getRegistrationCategoryKey(identity: RegistrationCategoryIdentity): string {
  return `${identity.discipline}:${identity.experienceLevel}:${identity.ageDivisionId}:${identity.weightCategoryId}`
}

export function parseRegistrationCategoryKey(
  categoryKey: string,
): RegistrationCategoryIdentity | null {
  const parts = categoryKey.split(':')
  if (parts.length !== 4) return null
  return {
    discipline: parts[0],
    experienceLevel: parts[1],
    ageDivisionId: parts[2],
    weightCategoryId: parts[3],
  }
}

export function getCategoryLabelFromKey(categoryKey: string): string {
  const identity = parseRegistrationCategoryKey(categoryKey)
  if (!identity) return categoryKey
  return getTournamentCategoryLabel(
    identity.ageDivisionId,
    identity.weightCategoryId,
    identity.experienceLevel as ExperienceLevelId,
  )
}

export function getCategoryTitleFromKey(categoryKey: string): string {
  const identity = parseRegistrationCategoryKey(categoryKey)
  if (!identity) return categoryKey
  return `${getDisciplineShortLabel(identity.discipline)} · ${getCategoryLabelFromKey(categoryKey)}`
}

function assertAgeDivisionMatchesGender(ageDivisionId: string, gender: string): void {
  const g = gender.toLowerCase()
  if (g === 'male' || g === 'm') {
    if (!ageDivisionId.startsWith('m_')) {
      throw new Error(`ageDivisionId ${ageDivisionId} does not match male athlete`)
    }
  } else if (g === 'female' || g === 'f') {
    if (!ageDivisionId.startsWith('f_')) {
      throw new Error(`ageDivisionId ${ageDivisionId} does not match female athlete`)
    }
  }
}
