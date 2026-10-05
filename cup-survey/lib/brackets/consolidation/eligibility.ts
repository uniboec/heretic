import { prisma } from '../../prisma'
import {
  getRegistrationCategoryKey,
  parseRegistrationCategoryKey,
} from '../../registration/categoryIdentity'
import {
  getEligibleAgeDivisions,
  getWeightCategoriesForDivision,
  validateCategorySelection,
} from '../../registration/categoryRules'
import { applyActionChain } from './neighbors'
import type { ConsolidationAction, ConsolidationStep } from './types'

export type ConsolidationAthleteContext = {
  entryId: string
  birthDate: string
  gender: 'male' | 'female'
}

export async function loadConsolidationAthleteContexts(
  entryIds: string[],
): Promise<Map<string, ConsolidationAthleteContext>> {
  if (entryIds.length === 0) return new Map()
  const athletes = await prisma.athlete.findMany({
    where: {
      entries: {
        some: {
          id: { in: entryIds },
        },
      },
    },
    include: {
      entries: {
        where: { id: { in: entryIds } },
        select: { id: true },
      },
    },
  })

  const map = new Map<string, ConsolidationAthleteContext>()
  for (const athlete of athletes) {
    const gender =
      athlete.gender?.toLowerCase() === 'female' || athlete.gender?.toLowerCase() === 'f'
        ? 'female'
        : 'male'
    const birthDate = athlete.birthDate.toISOString().slice(0, 10)
    for (const entry of athlete.entries) {
      map.set(entry.id, { entryId: entry.id, birthDate, gender })
    }
  }
  return map
}

function normalizeGender(gender: 'male' | 'female'): 'male' | 'female' {
  return gender
}

export function assertGroupEligibleForTarget(input: {
  athletes: ConsolidationAthleteContext[]
  targetCategoryKey: string
  actions: ConsolidationAction[]
}): string | null {
  const targetIdentity = parseRegistrationCategoryKey(input.targetCategoryKey)
  if (!targetIdentity) return 'GROUP_INELIGIBLE'

  const hasExperienceUp = input.actions.some((action) => action.type === 'EXPERIENCE_UP')
  const hasAgeUp = input.actions.some((action) => action.type === 'AGE_UP')

  for (const athlete of input.athletes) {
    const gender = normalizeGender(athlete.gender)

    if (hasExperienceUp && targetIdentity.experienceLevel !== 'experienced') {
      return 'GROUP_INELIGIBLE'
    }

    if (hasAgeUp) {
      const eligibleDivisions = getEligibleAgeDivisions(athlete.birthDate, gender)
      if (!eligibleDivisions.some((division) => division.id === targetIdentity.ageDivisionId)) {
        return 'GROUP_INELIGIBLE'
      }
    }

    const validationError = validateCategorySelection({
      birthDate: athlete.birthDate,
      gender,
      ageDivisionId: targetIdentity.ageDivisionId,
      weightCategoryId: targetIdentity.weightCategoryId,
    })
    if (validationError) {
      return 'GROUP_INELIGIBLE'
    }

    const weights = getWeightCategoriesForDivision(targetIdentity.ageDivisionId)
    if (!weights.some((weight) => weight.id === targetIdentity.weightCategoryId)) {
      return 'GROUP_INELIGIBLE'
    }
  }

  return null
}

export function stepAllowsTarget(
  sourceCategoryKey: string,
  targetCategoryKey: string,
  actions: ConsolidationAction[],
): boolean {
  const source = parseRegistrationCategoryKey(sourceCategoryKey)
  if (!source) return false

  const expected = applyActionChain(source, actions)
  if (!expected) return false

  return getRegistrationCategoryKey(expected) === targetCategoryKey
}

/** @deprecated Use actions[] overload. Kept for transitional callers. */
export function assertGroupEligibleForTargetStep(input: {
  athletes: ConsolidationAthleteContext[]
  targetCategoryKey: string
  step: ConsolidationStep
}): string | null {
  return assertGroupEligibleForTarget({
    athletes: input.athletes,
    targetCategoryKey: input.targetCategoryKey,
    actions: input.step.actions,
  })
}
