import type { ConsolidationStep } from './types'
import { getStepPrimaryActionType } from './policyHash'
import { parseRegistrationCategoryKey } from '../../registration/categoryIdentity'
import {
  compareCategoryIdentity,
  getAgeDivisionSortIndex,
  getWeightSortIndex,
} from './neighbors'

export function sortSourcesForStep(
  categoryKeys: string[],
  step: ConsolidationStep,
): string[] {
  const stepType = getStepPrimaryActionType(step)
  const keys = [...categoryKeys]
  switch (stepType) {
    case 'WEIGHT_UP':
      return keys.sort((a, b) => {
        const identityA = parseRegistrationCategoryKey(a)
        const identityB = parseRegistrationCategoryKey(b)
        if (!identityA || !identityB) return a.localeCompare(b)
        const weightDiff =
          getWeightSortIndex(identityA.ageDivisionId, identityA.weightCategoryId) -
          getWeightSortIndex(identityB.ageDivisionId, identityB.weightCategoryId)
        if (weightDiff !== 0) return weightDiff
        return compareCategoryIdentity(a, b)
      })
    case 'WEIGHT_DOWN':
      return keys.sort((a, b) => {
        const identityA = parseRegistrationCategoryKey(a)
        const identityB = parseRegistrationCategoryKey(b)
        if (!identityA || !identityB) return a.localeCompare(b)
        const weightDiff =
          getWeightSortIndex(identityB.ageDivisionId, identityB.weightCategoryId) -
          getWeightSortIndex(identityA.ageDivisionId, identityA.weightCategoryId)
        if (weightDiff !== 0) return weightDiff
        return compareCategoryIdentity(a, b)
      })
    case 'AGE_UP':
      return keys.sort((a, b) => {
        const identityA = parseRegistrationCategoryKey(a)
        const identityB = parseRegistrationCategoryKey(b)
        if (!identityA || !identityB) return a.localeCompare(b)
        const ageDiff =
          getAgeDivisionSortIndex(identityA.ageDivisionId) -
          getAgeDivisionSortIndex(identityB.ageDivisionId)
        if (ageDiff !== 0) return ageDiff
        return compareCategoryIdentity(a, b)
      })
    case 'EXPERIENCE_UP':
      return keys.sort(compareCategoryIdentity)
    default:
      return keys.sort(compareCategoryIdentity)
  }
}
