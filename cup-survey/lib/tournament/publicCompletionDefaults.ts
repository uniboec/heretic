import type { PublicBracketCompletionMode } from '@/lib/brackets/publicCategoryFilters'
import type { PublicBoutCompletionMode } from '@/lib/bouts/publicBoutCompletion'

export type CompletionCounts = {
  active: number
  completed: number
}

/** When nothing is active but completed items exist, open the completed section. */
export function defaultPublicCompletionMode(
  counts: CompletionCounts,
): PublicBracketCompletionMode | PublicBoutCompletionMode {
  if (counts.active === 0 && counts.completed > 0) return 'completed'
  return 'active'
}

export type PublicAwardsTab = 'queue' | 'completed'

export function defaultPublicAwardsTab(input: {
  queueCount: number
  completedCount: number
}): PublicAwardsTab {
  if (input.queueCount === 0 && input.completedCount > 0) return 'completed'
  return 'queue'
}
