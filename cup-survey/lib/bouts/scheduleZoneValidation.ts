import { ScheduleStructuralMutationBlockedError } from './errors'
import type { NormalizedBoutsPageSettings } from './normalizeBoutsPageSettings'

export function assertStructuralScheduleMutationAllowed(
  settings: Pick<NormalizedBoutsPageSettings, 'scheduleLegacyGap'>,
): void {
  if (settings.scheduleLegacyGap) {
    throw new ScheduleStructuralMutationBlockedError()
  }
}

export function assertCrossMatMoveAllowed(input: {
  sourceBoutId: string
  destinationMatIndex: number
  displayByBoutId: Map<string, { isInEditableZone: boolean; matNumber: number | null }>
  sourceMatIndex: number
}): void {
  const sourceMeta = input.displayByBoutId.get(input.sourceBoutId)
  if (!sourceMeta?.isInEditableZone) {
    throw new ScheduleStructuralMutationBlockedError(
      'Cross-mat move allowed only from editable zone',
    )
  }

  if (sourceMeta.matNumber != null && sourceMeta.matNumber !== input.sourceMatIndex) {
    throw new ScheduleStructuralMutationBlockedError(
      'Cross-mat move source mat mismatch',
    )
  }
}

export function findEditableZoneBoundary(
  queue: Array<{ isFrozen: boolean }>,
): number {
  let boundary = 0
  for (const entry of queue) {
    if (entry.isFrozen) {
      boundary += 1
    } else {
      break
    }
  }
  return boundary
}
