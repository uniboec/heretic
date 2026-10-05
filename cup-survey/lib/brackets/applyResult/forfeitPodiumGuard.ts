import type { CategoryResult } from '../core/types'

/**
 * Forfeit bouts may have boutElapsedMs=0/null in mat-control audit fields.
 * Read-path must not overwrite a valid stored complete podium from such bouts alone.
 * P0.1 stored-wins invariant covers this; this helper documents the guard for write-path callers.
 */
export function shouldPreserveStoredPodiumOnForfeitRead(
  stored: CategoryResult | null | undefined,
): boolean {
  return stored?.status === 'complete' && (stored.placements?.length ?? 0) > 0
}
