import { describe, expect, it } from 'vitest'
import { normalizeAnnouncerText, normalizeMatNumber } from '../text/normalize'

describe('normalizeAnnouncerText', () => {
  it('normalizes mat numbers', () => {
    expect(normalizeMatNumber(2)).toContain('два')
    expect(normalizeAnnouncerText('На татами №2')).toContain('два')
  })

  it('normalizes weight classes', () => {
    expect(normalizeAnnouncerText('категория -60 кг')).toContain('шестьдесят')
  })

  it('replaces middle dots and multiplication signs for speech', () => {
    const text = normalizeAnnouncerText('Тактик Контрол · Новички · 16–17 лет × тест')
    expect(text).not.toMatch(/[·×]/)
    expect(text).toContain('Тактик Контрол, Новички')
  })
})
