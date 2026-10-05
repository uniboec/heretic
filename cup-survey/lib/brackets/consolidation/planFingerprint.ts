import { stableJsonHash } from '../live/mutationFingerprint'
import type { ConsolidationPlan } from './types'

export function canonicalFinalPlacements(plan: ConsolidationPlan) {
  return [...plan.finalPlacements]
    .sort((a, b) => a.entryId.localeCompare(b.entryId))
    .map((item) => ({
      entryId: item.entryId,
      fromCategoryKey: item.fromCategoryKey,
      finalCategoryKey: item.finalCategoryKey,
    }))
}

export function canonicalTrace(plan: ConsolidationPlan) {
  return [...plan.trace]
    .sort((a, b) => a.hopIndex - b.hopIndex || a.stepIndex - b.stepIndex)
    .map((hop) => ({
      hopIndex: hop.hopIndex,
      stepIndex: hop.stepIndex,
      entryIds: [...hop.entryIds].sort(),
      fromCategoryKey: hop.fromCategoryKey,
      toCategoryKey: hop.toCategoryKey,
      actions: hop.actions,
      ...(hop.step ? { step: hop.step } : {}),
    }))
}

export function hashPlan(plan: ConsolidationPlan): string {
  return stableJsonHash({
    finalPlacements: canonicalFinalPlacements(plan),
    trace: canonicalTrace(plan),
    affectedCategoryKeys: [...plan.affectedCategoryKeys].sort(),
  })
}
