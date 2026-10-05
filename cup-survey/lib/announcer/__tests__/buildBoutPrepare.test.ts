import { describe, expect, it } from 'vitest'
import type { AnnouncerRule } from '@prisma/client'
import type { BoutCallPayload } from '../types'
import { buildBoutCallText } from '../text/buildBoutCall'
import { testAnnouncerRule } from './fixtures'

const payload: BoutCallPayload = {
  boutId: 'b1',
  matIndex: 1,
  categoryTitle: 'Юноши · до 60 кг',
  sideA: { corner: 'red', displayName: 'Иванов Иван' },
  sideB: { corner: 'blue', displayName: 'Петров Пётр' },
}

function rule(overrides: Partial<AnnouncerRule> = {}): AnnouncerRule {
  return testAnnouncerRule({
    eventType: 'BOUT_PREPARE',
    priority: 80,
    includeClub: false,
    ttlSeconds: 150,
    ...overrides,
  })
}

describe('buildBoutPrepare text', () => {
  it('uses prepare verb and omits corners by default', () => {
    const text = buildBoutCallText(payload, rule(), 'готовятся')
    expect(text).toContain('готовятся')
    expect(text).not.toContain('угол')
  })

  it('includes corners when enabled on prepare rule', () => {
    const callText = buildBoutCallText(payload, rule({ includeCorner: true }), 'приглашаются')
    const prepareText = buildBoutCallText(payload, rule({ includeCorner: false }), 'готовятся')
    expect(callText).toContain('красный угол')
    expect(prepareText).not.toContain('угол')
  })
})
