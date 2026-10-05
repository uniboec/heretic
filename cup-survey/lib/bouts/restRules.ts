import { TOURNAMENT_SCOPE_ID } from '../config/tournament'

export const REST_SCOPE_ID = TOURNAMENT_SCOPE_ID

export type RestComputationInput = {
  mainBoutDurationMs: number
  schedulePhase: 'elimination' | 'bronze' | 'final' | 'round_robin'
  officialEndedAt: Date
  restOverrideUntil?: Date | null
}

export function computeRestUntil(input: RestComputationInput): Date {
  const multiplier = input.schedulePhase === 'final' ? 2 : 1
  const restMs = input.mainBoutDurationMs * multiplier
  const baseRestUntil = new Date(input.officialEndedAt.getTime() + restMs)

  if (input.restOverrideUntil && input.restOverrideUntil.getTime() > baseRestUntil.getTime()) {
    return input.restOverrideUntil
  }

  return baseRestUntil
}

export function isAthleteResting(restUntil: Date | null | undefined, now: Date): boolean {
  if (!restUntil) return false
  return restUntil.getTime() > now.getTime()
}

export function restRemainingMs(restUntil: Date, now: Date): number {
  return Math.max(0, restUntil.getTime() - now.getTime())
}

/** Policy: NO_SHOW rest behavior — document in UI when decided (§8 open question). */
export const NO_SHOW_REST_POLICY = 'REST_ON_NO_SHOW' as const
