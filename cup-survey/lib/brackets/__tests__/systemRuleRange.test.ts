import { describe, expect, it } from 'vitest'
import {
  getCompatibleSystemIdsForRuleRange,
  isSystemCompatibleWithRuleRange,
} from '../core/formatRules'

describe('system rule range compatibility', () => {
  it('allows champion only for exactly 1 participant', () => {
    expect(isSystemCompatibleWithRuleRange('champion', 1, 1)).toBe(true)
    expect(isSystemCompatibleWithRuleRange('champion', 1, 2)).toBe(false)
    expect(getCompatibleSystemIdsForRuleRange(1, 1)).toEqual(['champion'])
  })

  it('allows three_way only for exactly 3 participants', () => {
    expect(isSystemCompatibleWithRuleRange('three_way', 3, 3)).toBe(true)
    expect(isSystemCompatibleWithRuleRange('three_way', 2, 3)).toBe(false)
    expect(isSystemCompatibleWithRuleRange('three_way', 4, 5)).toBe(false)
  })

  it('lists three_way only in 3–3 rule options', () => {
    expect(getCompatibleSystemIdsForRuleRange(3, 3)).toEqual([
      'olympic',
      'round_robin',
      'three_way',
    ])
    expect(getCompatibleSystemIdsForRuleRange(4, 5)).toEqual(['olympic', 'round_robin'])
  })
})
