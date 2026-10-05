import type { InternalBout } from './types'

export type AthleteSpacingDeferReason = 'ATHLETE_SPACING' | 'ATHLETE_BUSY' | 'EFFECTIVE_REST'

export type DeferredBout = {
  boutId: string
  reason: AthleteSpacingDeferReason
  athleteId: string
  requiredWave?: number
  currentWave?: number
  effectiveRestUntil?: string
}

export type GlobalAthleteSpacingResult = {
  perMatOrder: Map<number, InternalBout[]>
  deferredBouts: DeferredBout[]
  wavePatch: Record<string, number>
}
