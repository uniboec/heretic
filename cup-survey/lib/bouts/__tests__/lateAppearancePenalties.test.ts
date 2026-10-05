import { describe, expect, it } from 'vitest'
import { countLateAppearancePenaltySteps } from '../lateAppearancePenalties'

describe('countLateAppearancePenaltySteps', () => {
  it('applies no penalties within grace period', () => {
    expect(countLateAppearancePenaltySteps(0)).toBe(0)
    expect(countLateAppearancePenaltySteps(30_000)).toBe(0)
  })

  it('applies escalating penalties after grace period', () => {
    expect(countLateAppearancePenaltySteps(31_000)).toBe(0)
    expect(countLateAppearancePenaltySteps(61_000)).toBe(1)
    expect(countLateAppearancePenaltySteps(121_000)).toBe(2)
    expect(countLateAppearancePenaltySteps(181_000)).toBe(3)
  })
})
