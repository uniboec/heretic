import { getWeightCategory, getWeightCategoryLabel } from '@/lib/config/fseCategories'
import { parseRegistrationCategoryKey } from '@/lib/registration/categoryIdentity'
import type { MandateCategoryWeightResult, WeightCategoryCheckResult } from './types'

export function checkWeightForCategory(
  actualWeightKg: number,
  weightCategoryId: string,
): WeightCategoryCheckResult {
  const category = getWeightCategory(weightCategoryId)
  if (!category) return 'NOT_APPLICABLE'
  if (category.maxWeight == null && category.minWeight == null) {
    return 'NOT_APPLICABLE'
  }

  if (category.maxWeight != null) {
    if (actualWeightKg > category.maxWeight) return 'OVER_LIMIT'
    return 'PASSED'
  }

  if (category.minWeight != null) {
    if (actualWeightKg <= category.minWeight) return 'UNDER_LIMIT'
    return 'PASSED'
  }

  return 'NOT_APPLICABLE'
}

function weightDeltaKg(
  actualWeightKg: number,
  result: WeightCategoryCheckResult,
  weightCategoryId: string,
): number | undefined {
  if (result === 'NOT_APPLICABLE' || result === 'PASSED') return undefined
  const category = getWeightCategory(weightCategoryId)
  if (!category) return undefined
  if (result === 'OVER_LIMIT' && category.maxWeight != null) {
    return roundWeightDelta(actualWeightKg - category.maxWeight)
  }
  if (result === 'UNDER_LIMIT' && category.minWeight != null) {
    return roundWeightDelta(category.minWeight - actualWeightKg)
  }
  return undefined
}

function roundWeightDelta(value: number): number {
  return Math.round(value * 100) / 100
}

export function buildCategoryWeightResults(
  actualWeightKg: number,
  categoryKeys: string[],
): MandateCategoryWeightResult[] {
  return categoryKeys.map((categoryKey) => {
    const identity = parseRegistrationCategoryKey(categoryKey)
    const categoryLabel = identity
      ? getWeightCategoryLabel(identity.weightCategoryId)
      : categoryKey
    if (!identity) {
      return {
        categoryKey,
        categoryLabel,
        result: 'NOT_APPLICABLE' as const,
      }
    }
    const result = checkWeightForCategory(actualWeightKg, identity.weightCategoryId)
    return {
      categoryKey,
      categoryLabel,
      result,
      deltaKg: weightDeltaKg(actualWeightKg, result, identity.weightCategoryId),
    }
  })
}

export function isWeightEligibleFromCategoryResults(
  results: MandateCategoryWeightResult[],
): boolean {
  const applicable = results.filter((row) => row.result !== 'NOT_APPLICABLE')
  if (applicable.length === 0) return true
  return applicable.every((row) => row.result === 'PASSED')
}
