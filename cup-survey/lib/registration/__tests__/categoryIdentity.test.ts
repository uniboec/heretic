import { describe, expect, it } from 'vitest'
import { getRegistrationCategoryIdentity, getRegistrationCategoryKey } from '../categoryIdentity'

describe('categoryIdentity', () => {
  it('builds canonical key without gender field', () => {
    const identity = getRegistrationCategoryIdentity(
      {
        discipline: 'tactic_control',
        experienceLevel: 'beginner',
        ageDivisionId: 'm_juniors_1',
        weightCategoryId: 'w_66',
      },
      { gender: 'male' },
    )
    expect(identity).not.toBeNull()
    expect(getRegistrationCategoryKey(identity!)).toBe(
      'tactic_control:beginner:m_juniors_1:w_66',
    )
  })

  it('rejects mismatched gender prefix', () => {
    expect(() =>
      getRegistrationCategoryIdentity(
        {
          discipline: 'tactic_control',
          experienceLevel: 'beginner',
          ageDivisionId: 'f_juniors_1',
          weightCategoryId: 'w_66',
        },
        { gender: 'male' },
      ),
    ).toThrow()
  })
})
