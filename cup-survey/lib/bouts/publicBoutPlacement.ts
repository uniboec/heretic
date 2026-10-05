import type { BoutSchedulePhase } from './types'

export type PublicBoutPlacementKind = 'final' | 'bronze'

export function resolvePublicBoutPlacement(input: {
  schedulePhase?: BoutSchedulePhase | null
}): PublicBoutPlacementKind | null {
  if (input.schedulePhase === 'final') return 'final'
  if (input.schedulePhase === 'bronze') return 'bronze'
  return null
}

export const PUBLIC_BOUT_PLACEMENT_LABELS: Record<PublicBoutPlacementKind, string> = {
  final: 'Финал · 1 место',
  bronze: 'Бой за 3 место',
}

export const PUBLIC_BOUT_PLACEMENT_SHORT: Record<PublicBoutPlacementKind, string> = {
  final: '1 место',
  bronze: '3 место',
}
