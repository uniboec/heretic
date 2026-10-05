export function resolveBulkMoveTargetOptions(
  selectedBouts: ReadonlyArray<{ matIndex: number }>,
  matCount: number,
): number[] {
  if (matCount <= 1 || selectedBouts.length === 0) return []
  return Array.from({ length: matCount }, (_, index) => index + 1).filter((matIndex) =>
    selectedBouts.some((bout) => bout.matIndex !== matIndex),
  )
}

export function isBoutSelectableForBulkActions(displayStatus: string): boolean {
  return displayStatus !== 'completed' && displayStatus !== 'in_progress'
}
