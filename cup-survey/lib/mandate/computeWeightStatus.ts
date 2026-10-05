import type { WeightCheckMode } from '@prisma/client'
import { isManualWeightFingerprintCurrent } from './categoryFingerprint'
import {
  buildCategoryWeightResults,
  isWeightEligibleFromCategoryResults,
} from './weightCheck'
import type { MandateCheckRecord, WeightStatus } from './types'

export function hasWeighInFromCheckRecord(
  check: Pick<
    MandateCheckRecord,
    'weightCheckMode' | 'actualWeightKg' | 'manualWeightVerified'
  > | null,
): boolean {
  if (!check) return false
  if (check.weightCheckMode === 'AUTO') return check.actualWeightKg != null
  if (check.weightCheckMode === 'MANUAL') return check.manualWeightVerified
  if (check.weightCheckMode === 'MANUAL_ISSUE') return true
  return false
}

export function computeWeightStatus(input: {
  check: Pick<
    MandateCheckRecord,
    | 'weightCheckMode'
    | 'actualWeightKg'
    | 'manualWeightVerified'
    | 'manualWeightCategoryFingerprint'
  > | null
  categoryKeys: string[]
}): WeightStatus {
  const categoryKeys = [...new Set(input.categoryKeys.filter(Boolean))].sort()
  const mode = input.check?.weightCheckMode ?? null

  if (!input.check || !mode) {
    return {
      hasWeighIn: false,
      weightEligible: false,
      manualStale: false,
      categoryResults: [],
    }
  }

  if (mode === 'AUTO') {
    const weight = input.check.actualWeightKg
    if (weight == null) {
      return {
        hasWeighIn: false,
        weightEligible: false,
        manualStale: false,
        categoryResults: [],
      }
    }
    const categoryResults = buildCategoryWeightResults(weight, categoryKeys)
    return {
      hasWeighIn: true,
      weightEligible: isWeightEligibleFromCategoryResults(categoryResults),
      manualStale: false,
      categoryResults,
    }
  }

  if (mode === 'MANUAL_ISSUE') {
    return {
      hasWeighIn: true,
      weightEligible: false,
      manualStale: false,
      categoryResults: [],
    }
  }

  const manualStale =
    input.check.manualWeightVerified &&
    !isManualWeightFingerprintCurrent(input.check.manualWeightCategoryFingerprint, categoryKeys)

  const hasWeighIn = input.check.manualWeightVerified
  const weightEligible =
    input.check.manualWeightVerified &&
    isManualWeightFingerprintCurrent(input.check.manualWeightCategoryFingerprint, categoryKeys)

  return {
    hasWeighIn,
    weightEligible,
    manualStale,
    categoryResults: [],
  }
}

export function hasAthleteWeighIn(
  check: Parameters<typeof computeWeightStatus>[0]['check'],
  categoryKeys: string[],
): boolean {
  return computeWeightStatus({ check, categoryKeys }).hasWeighIn
}

export function resolveWeightCheckMode(
  check: Pick<MandateCheckRecord, 'weightCheckMode'> | null,
): WeightCheckMode | null {
  return check?.weightCheckMode ?? null
}
