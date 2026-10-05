import { getEffectiveSystemId } from './formatRules'
import { systemSupportsBouts } from '../systemMeta'

export function categoryRequiresBouts(input: {
  status: string
  autoSystemId: string | null
  systemOverride: string | null
  participantCount: number
}): boolean {
  if (input.status !== 'ACTIVE') return false
  if (input.participantCount < 2) return false
  const effectiveSystemId = getEffectiveSystemId(input.autoSystemId, input.systemOverride)
  return systemSupportsBouts(effectiveSystemId)
}

/** Single-athlete categories go to awards schedule, not bouts. */
export function categoryEligibleForAwardsSchedule(input: {
  status: string
  autoSystemId: string | null
  systemOverride: string | null
  participantCount: number
}): boolean {
  if (input.status !== 'ACTIVE') return false
  if (input.participantCount !== 1) return false
  return !categoryRequiresBouts(input)
}
