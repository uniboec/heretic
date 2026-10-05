import type { BracketPublicationState } from '@prisma/client'
import { BracketOperationError } from '../core/errors'

export type CategoryLockLevel = 'OPEN' | 'RELEASED' | 'PLAYED'

export function getCategoryLockLevel(
  publicationState: Pick<BracketPublicationState, 'boutsReleased'> | null | undefined,
): CategoryLockLevel {
  if (!publicationState?.boutsReleased) return 'OPEN'
  // v1.1+: check BoutRecord for PLAYED
  return 'RELEASED'
}

export function buildLockLevelsMap(
  categoryKeys: string[],
  publicationStates: Array<Pick<BracketPublicationState, 'categoryKey' | 'boutsReleased'>>,
): Record<string, CategoryLockLevel> {
  const byKey = new Map(publicationStates.map((s) => [s.categoryKey, s]))
  const result: Record<string, CategoryLockLevel> = {}
  for (const key of categoryKeys) {
    result[key] = getCategoryLockLevel(byKey.get(key))
  }
  return result
}

export function assertRedrawAllowed(lockLevel: CategoryLockLevel, categoryKey: string): void {
  if (lockLevel !== 'OPEN') {
    throw new BracketOperationError(
      'CATEGORY_BOUTS_RELEASED',
      `Категория «${categoryKey}» уже в расписании — жеребьёвка недоступна`,
    )
  }
}

export function assertResetAllowed(
  publicationStates: Array<Pick<BracketPublicationState, 'categoryKey' | 'boutsReleased'>>,
): void {
  const released = publicationStates.filter((s) => s.boutsReleased)
  if (released.length > 0) {
    throw new BracketOperationError(
      'RESET_BLOCKED_BOUTS_RELEASED',
      'Сброс недоступен: есть категории в расписании',
    )
  }
}

export function assertRestoreAllowed(affectedReleasedKeys: string[]): void {
  if (affectedReleasedKeys.length === 0) return
  throw new BracketOperationError(
    'RESTORE_AFFECTED_RELEASED_CATEGORY',
    `Восстановление затронет категории в поединках: ${affectedReleasedKeys.join(', ')}`,
  )
}
