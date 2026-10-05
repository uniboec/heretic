import { describe, expect, it } from 'vitest'
import type { AnnouncerRule } from '@prisma/client'
import { formatCategorySpeech, parseCategoryTitle } from '../text/category'
import { testAnnouncerRule } from './fixtures'

function rule(overrides: Partial<AnnouncerRule> = {}): AnnouncerRule {
  return testAnnouncerRule({ includeCategory: false, ...overrides })
}

describe('parseCategoryTitle', () => {
  it('extracts age and weight parts', () => {
    const parsed = parseCategoryTitle('Клоус Контрол · Опытные · 16–17 лет · свыше 71 кг')
    expect(parsed.age).toBe('16–17 лет')
    expect(parsed.weight).toBe('свыше 71 кг')
  })
})

describe('formatCategorySpeech', () => {
  it('uses full category when includeCategory=true', () => {
    const text = formatCategorySpeech('Юноши · до 60 кг', rule({ includeCategory: true }))
    expect(text).toContain('категории')
    expect(text).toContain('до 60 кг')
  })

  it('uses age and weight separately when includeCategory=false', () => {
    const text = formatCategorySpeech('Опытные · 16–17 лет · свыше 71 кг', rule())
    expect(text).toContain('16–17 лет')
    expect(text).toContain('свыше 71 кг')
  })

  it('converts technical category keys to readable titles', () => {
    const text = formatCategorySpeech(
      'tactic_control:novice:m_boys_3:m_boys_3_w_le_29',
      rule({ includeCategory: true }),
    )
    expect(text).toContain('категории')
    expect(text).toContain('Тактик')
    expect(text).not.toContain('tactic_control')
    expect(text).not.toContain('m_boys_3_w_le_29')
  })
})
