import { describe, expect, it } from 'vitest'
import { getCategoryTitleFromKey, getRegistrationCategoryKey } from '../categoryIdentity'

describe('getCategoryTitleFromKey', () => {
  it('returns human-readable title', () => {
    const key = getRegistrationCategoryKey({
      discipline: 'tactic_control',
      experienceLevel: 'novice',
      ageDivisionId: 'm_juniors_1',
      weightCategoryId: 'm_w_66',
    })
    const title = getCategoryTitleFromKey(key)
    expect(title).toContain('Тактик')
    expect(title).not.toContain('Tactic-Control')
    expect(title).not.toContain('Close-Control')
    expect(title).not.toBe(key)
  })

  it('formats consolidated weight ids like m_juniors_1_w_gt_71', () => {
    const key = getRegistrationCategoryKey({
      discipline: 'close_control',
      experienceLevel: 'experienced',
      ageDivisionId: 'm_juniors_1',
      weightCategoryId: 'm_juniors_1_w_gt_71',
    })
    const title = getCategoryTitleFromKey(key)
    expect(title).toBe('Клоус Контрол · Опытные · 16–17 лет · свыше 71 кг')
    expect(title).not.toContain('m_juniors_1_w_gt_71')
  })
})
