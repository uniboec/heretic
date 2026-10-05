import { describe, expect, it } from 'vitest'
import type { AnnouncerRule } from '@prisma/client'
import type { BoutCallPayload } from '../types'
import { buildBoutCallText } from '../text/buildBoutCall'
import { testAnnouncerRule } from './fixtures'

const basePayload: BoutCallPayload = {
  boutId: 'bout-1',
  matIndex: 2,
  categoryTitle: 'Юноши 60 кг',
  sideA: { corner: 'red', displayName: 'Иванов Иван', clubName: 'Буревестник' },
  sideB: { corner: 'blue', displayName: 'Петров Пётр', clubName: 'Спарта' },
}

function rule(overrides: Partial<AnnouncerRule> = {}): AnnouncerRule {
  return testAnnouncerRule({ includeCueSound: true, ttlSeconds: 75, ...overrides })
}

describe('buildBoutCallText', () => {
  it('includes corner labels when includeCorner=true', () => {
    const text = buildBoutCallText(basePayload, rule({ includeCorner: true }), 'приглашаются')
    expect(text).toContain('красный угол')
    expect(text).toContain('синий угол')
  })

  it('omits corner labels when includeCorner=false', () => {
    const text = buildBoutCallText(basePayload, rule({ includeCorner: false }), 'готовятся')
    expect(text).not.toContain('угол')
  })

  it('uses different verbs for call and prepare', () => {
    const call = buildBoutCallText(basePayload, rule(), 'приглашаются')
    const prepare = buildBoutCallText(basePayload, rule(), 'готовятся')
    expect(call).toContain('приглашаются')
    expect(prepare).toContain('готовятся')
  })
})
