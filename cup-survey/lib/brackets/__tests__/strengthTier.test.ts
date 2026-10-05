import { describe, expect, it } from 'vitest'
import { getStrengthTier } from '../core/seeding/strengthTier'

describe('getStrengthTier', () => {
  it('orders ranks from child to msmk', () => {
    expect(getStrengthTier('child_1')).toBeLessThan(getStrengthTier('youth_1')!)
    expect(getStrengthTier('youth_1')).toBeLessThan(getStrengthTier('adult_1')!)
    expect(getStrengthTier('adult_1')).toBeLessThan(getStrengthTier('kms')!)
    expect(getStrengthTier('kms')).toBeLessThan(getStrengthTier('ms')!)
    expect(getStrengthTier('ms')).toBeLessThan(getStrengthTier('msmk')!)
  })

  it('returns null for missing rank', () => {
    expect(getStrengthTier(null)).toBeNull()
    expect(getStrengthTier('none')).toBeNull()
  })
})
