import { describe, expect, it } from 'vitest'
import { recalculateDrawFormat } from '../core/recalculate'
import '../systems'

const rules = [
  {
    id: 'r1',
    minParticipants: 2,
    maxParticipants: 32,
    systemId: 'olympic',
    defaultBronzeMode: 'ONE' as const,
    allowedSystemIds: ['olympic'],
    sortOrder: 1,
    enabled: true,
  },
]

describe('PATCH format-rules invariant', () => {
  it('recalculate updates status fields without touching fingerprint fields', () => {
    const before = {
      id: 'draw-1',
      categoryKey: 'a',
      status: 'ACTIVE' as const,
      statusReason: null,
      autoSystemId: 'olympic',
      systemOverride: null,
      autoBronzeMode: 'ONE' as const,
      bronzeModeOverride: null,
      participantCount: 4,
    }
    const result = recalculateDrawFormat(before, rules)
    expect(result).toMatchObject({
      status: 'ACTIVE',
      autoSystemId: 'olympic',
    })
    expect(result).not.toHaveProperty('sourceFingerprint')
    expect(result).not.toHaveProperty('seedingFingerprint')
  })
})
