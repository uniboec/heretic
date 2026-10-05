import { describe, expect, it } from 'vitest'
import { FASTEST_FIGHT_VICTORY_METHODS, isFastestFightEligible } from '../eligibility'

describe('isFastestFightEligible', () => {
  it('allows submission, choke and clear advantage', () => {
    for (const method of FASTEST_FIGHT_VICTORY_METHODS) {
      expect(isFastestFightEligible(method)).toBe(true)
    }
  })

  it('rejects non-ranking victory methods', () => {
    for (const method of ['FORFEIT', 'INJURY', 'POINTS', 'NO_SHOW', 'DISQUALIFICATION']) {
      expect(isFastestFightEligible(method)).toBe(false)
    }
  })
})
