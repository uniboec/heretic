import { RegistrationClosedError } from '../../registration/service'
import { isRegistrationClosed } from '../../registration/time'
import { getCategoryLockLevel } from './guard'

/** Policy D: user-facing registration edits blocked after registration closes. */
export function assertUserRegistrationChangesAllowed(): void {
  if (isRegistrationClosed()) {
    throw new RegistrationClosedError()
  }
}

export function filterOpenCategoryKeys(
  categoryKeys: string[],
  publicationStates: Array<{ categoryKey: string; boutsReleased: boolean }>,
): string[] {
  const byKey = new Map(publicationStates.map((state) => [state.categoryKey, state]))
  return categoryKeys.filter((key) => getCategoryLockLevel(byKey.get(key)) === 'OPEN')
}

/** When registration is closed, auto-sync may only touch OPEN categories. */
export function autoSyncCategoryKeysForRegistrationChange(
  categoryKeys: string[],
  publicationStates: Array<{ categoryKey: string; boutsReleased: boolean }>,
): string[] {
  if (!isRegistrationClosed()) {
    return categoryKeys
  }
  return filterOpenCategoryKeys(categoryKeys, publicationStates)
}
