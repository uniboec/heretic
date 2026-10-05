import { describe, expect, it, vi } from 'vitest'
import {
  assertUserRegistrationChangesAllowed,
  autoSyncCategoryKeysForRegistrationChange,
  filterOpenCategoryKeys,
} from '../policyD'

vi.mock('../../../registration/time', () => ({
  isRegistrationClosed: vi.fn(),
}))

import { isRegistrationClosed } from '../../../registration/time'
import { RegistrationClosedError } from '../../../registration/service'

describe('policyD', () => {
  it('blocks user registration edits when registration is closed', () => {
    vi.mocked(isRegistrationClosed).mockReturnValue(true)
    expect(() => assertUserRegistrationChangesAllowed()).toThrow(RegistrationClosedError)
  })

  it('allows user registration edits while registration is open', () => {
    vi.mocked(isRegistrationClosed).mockReturnValue(false)
    expect(() => assertUserRegistrationChangesAllowed()).not.toThrow()
  })

  it('filters auto-sync to OPEN categories when registration is closed', () => {
    vi.mocked(isRegistrationClosed).mockReturnValue(true)
    const publicationStates = [
      { categoryKey: 'cat:open', boutsReleased: false },
      { categoryKey: 'cat:released', boutsReleased: true },
    ]
    expect(
      autoSyncCategoryKeysForRegistrationChange(
        ['cat:open', 'cat:released'],
        publicationStates,
      ),
    ).toEqual(['cat:open'])
  })

  it('passes all category keys through while registration is open', () => {
    vi.mocked(isRegistrationClosed).mockReturnValue(false)
    const publicationStates = [{ categoryKey: 'cat:released', boutsReleased: true }]
    expect(
      autoSyncCategoryKeysForRegistrationChange(['cat:released'], publicationStates),
    ).toEqual(['cat:released'])
  })

  it('filterOpenCategoryKeys keeps only OPEN lock levels', () => {
    const publicationStates = [
      { categoryKey: 'cat:open', boutsReleased: false },
      { categoryKey: 'cat:released', boutsReleased: true },
    ]
    expect(filterOpenCategoryKeys(['cat:open', 'cat:released'], publicationStates)).toEqual([
      'cat:open',
    ])
  })
})
