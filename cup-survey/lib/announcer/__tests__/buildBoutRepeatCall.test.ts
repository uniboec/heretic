import { describe, expect, it } from 'vitest'
import type { BoutCallPayload } from '../types'
import { buildBoutRepeatCallText } from '../text/buildBoutCall'
import { testAnnouncerRule } from './fixtures'

describe('buildBoutRepeatCallText', () => {
  it('announces repeat call for one corner with club and city', () => {
    const payload: BoutCallPayload = {
      boutId: 'b1',
      matIndex: 1,
      sideA: { corner: 'red', displayName: 'Иванов Иван' },
      sideB: { corner: 'blue', displayName: 'Петров Пётр' },
      repeatCorner: 'blue',
      repeatSide: {
        corner: 'blue',
        displayName: 'Иванов Иван',
        clubName: 'Универсальный боец',
        city: 'Первоуральск',
      },
    }
    const text = buildBoutRepeatCallText(
      payload,
      testAnnouncerRule({
        includeCorner: true,
        includeClub: true,
        includeCity: true,
        includeMat: true,
      }),
    )
    expect(text).toContain('повторно приглашается')
    expect(text).toContain('синего угла')
    expect(text).toContain('Иванов Иван')
    expect(text).toContain('Универсальный боец')
    expect(text).toContain('Первоуральск')
  })
})
