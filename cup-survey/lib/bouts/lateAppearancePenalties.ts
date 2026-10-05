/** Grace period before any disciplinary sanction applies. */
export const LATE_APPEARANCE_GRACE_MS = 30_000

/** Thresholds (exclusive upper bound) for cumulative GENERAL ladder steps. */
const LATE_APPEARANCE_STEP_THRESHOLDS_MS = [60_000, 120_000, 180_000] as const

/**
 * Number of GENERAL disciplinary ladder steps to apply when an athlete arrives
 * after waiting. Steps are applied sequentially from the athlete's current position.
 */
export function countLateAppearancePenaltySteps(waitedMs: number): number {
  if (waitedMs <= LATE_APPEARANCE_GRACE_MS) {
    return 0
  }
  let steps = 0
  for (const threshold of LATE_APPEARANCE_STEP_THRESHOLDS_MS) {
    if (waitedMs > threshold) {
      steps += 1
    }
  }
  return steps
}
