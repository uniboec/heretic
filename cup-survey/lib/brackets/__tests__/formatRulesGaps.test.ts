import { describe, expect, it } from 'vitest'
import { validateEntireRuleSet } from '../core/formatRules'
import type { BracketFormatRuleLike } from '../core/types'
import '../systems'

const fullRules: BracketFormatRuleLike[] = [
  {
    id: '0',
    minParticipants: 1,
    maxParticipants: 1,
    systemId: 'champion',
    defaultBronzeMode: null,
    allowedSystemIds: ['champion'],
    sortOrder: -1,
    enabled: true,
  },
  {
    id: '1',
    minParticipants: 2,
    maxParticipants: 2,
    systemId: 'olympic',
    defaultBronzeMode: null,
    allowedSystemIds: ['olympic'],
    sortOrder: 0,
    enabled: true,
  },
  {
    id: '2',
    minParticipants: 3,
    maxParticipants: 3,
    systemId: 'three_way',
    defaultBronzeMode: null,
    allowedSystemIds: ['three_way', 'round_robin'],
    sortOrder: 1,
    enabled: true,
  },
  {
    id: '3',
    minParticipants: 4,
    maxParticipants: 5,
    systemId: 'olympic',
    defaultBronzeMode: 'ONE',
    allowedSystemIds: ['olympic', 'round_robin'],
    sortOrder: 2,
    enabled: true,
  },
  {
    id: '4',
    minParticipants: 6,
    maxParticipants: 32,
    systemId: 'olympic',
    defaultBronzeMode: 'ONE',
    allowedSystemIds: ['olympic'],
    sortOrder: 3,
    enabled: true,
  },
]

describe('format rules gap validation', () => {
  it('accepts complete 2..32 coverage', () => {
    expect(validateEntireRuleSet(fullRules)).toHaveLength(0)
  })

  it('rejects gap at N=5 when rule ends at 4', () => {
    const bad = fullRules.map((r) =>
      r.minParticipants === 4 ? { ...r, maxParticipants: 4 } : r,
    )
    expect(validateEntireRuleSet(bad).some((e) => e.code === 'RANGE_GAP')).toBe(true)
  })
})
