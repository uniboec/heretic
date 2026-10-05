import { describe, expect, it } from 'vitest'
import { resolveFormatRule } from '../core/formatRules'
import type { BracketFormatRuleLike } from '../core/types'

const rules: BracketFormatRuleLike[] = [
  {
    id: '1',
    minParticipants: 2,
    maxParticipants: 2,
    systemId: 'olympic',
    defaultBronzeMode: null,
    allowedSystemIds: ['olympic'],
    sortOrder: 1,
    enabled: true,
  },
  {
    id: '2',
    minParticipants: 3,
    maxParticipants: 5,
    systemId: 'round_robin',
    defaultBronzeMode: null,
    allowedSystemIds: ['round_robin', 'olympic'],
    sortOrder: 2,
    enabled: true,
  },
]

function isSystemAllowedForN(systemId: string, n: number) {
  const rule = resolveFormatRule(n, rules)
  return rule ? rule.allowedSystemIds.includes(systemId) : false
}

describe('publish allowedSystemIds gate', () => {
  it('rejects olympic for N=3 when only round_robin allowed by default rule', () => {
    expect(isSystemAllowedForN('olympic', 3)).toBe(true)
    expect(isSystemAllowedForN('round_robin', 3)).toBe(true)
  })

  it('rejects system outside allowedSystemIds', () => {
    expect(isSystemAllowedForN('round_robin', 2)).toBe(false)
  })
})
