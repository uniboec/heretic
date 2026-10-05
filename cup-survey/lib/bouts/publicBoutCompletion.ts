import { resolveBoutDisplayStatusFromTiming } from './presentation/boutDisplayStatus'
import type { BoutTiming } from './scheduleTypes'

export type PublicBoutCompletionMode = 'active' | 'completed' | 'all'

export function isPublicBoutCompleted(
  bout: { timing?: Pick<BoutTiming, 'displayStatus' | 'status'> },
): boolean {
  return resolveBoutDisplayStatusFromTiming(bout.timing) === 'completed'
}

export function matchesPublicBoutCompletionMode(
  bout: { timing?: Pick<BoutTiming, 'displayStatus' | 'status'> },
  mode: PublicBoutCompletionMode,
): boolean {
  if (mode === 'all') return true
  const completed = isPublicBoutCompleted(bout)
  return mode === 'completed' ? completed : !completed
}

export function countPublicBoutsByCompletion<
  T extends { timing?: Pick<BoutTiming, 'displayStatus' | 'status'> },
>(bouts: T[]): { active: number; completed: number; all: number } {
  let completed = 0
  for (const bout of bouts) {
    if (isPublicBoutCompleted(bout)) completed += 1
  }
  return {
    active: bouts.length - completed,
    completed,
    all: bouts.length,
  }
}
