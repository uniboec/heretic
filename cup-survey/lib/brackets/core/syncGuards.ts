import { BracketOperationError } from './errors'

export function assertCategorySyncAllowed(
  scope: 'all' | 'category',
  draftSourceRevision: bigint | null,
  currentRevision: bigint,
): void {
  if (
    scope === 'category' &&
    draftSourceRevision != null &&
    currentRevision !== draftSourceRevision
  ) {
    throw new BracketOperationError(
      'GLOBAL_SYNC_REQUIRED',
      'Сначала выполните обновление всего состава',
    )
  }
}
