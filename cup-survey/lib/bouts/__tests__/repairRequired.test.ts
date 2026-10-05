import { describe, expect, it } from 'vitest'
import { isBoutsRepairRequired } from '../repairRequired'

describe('isBoutsRepairRequired', () => {
  it('returns false when not visible', () => {
    expect(
      isBoutsRepairRequired({
        visible: false,
        boutsReleased: false,
        storedMatIndex: 3,
        matCount: 2,
      }),
    ).toBe(false)
  })

  it('returns false when already released', () => {
    expect(
      isBoutsRepairRequired({
        visible: true,
        boutsReleased: true,
        storedMatIndex: 3,
        matCount: 2,
      }),
    ).toBe(false)
  })

  it('returns true for visible Fixed out of range not released', () => {
    expect(
      isBoutsRepairRequired({
        visible: true,
        boutsReleased: false,
        storedMatIndex: 3,
        matCount: 2,
      }),
    ).toBe(true)
  })
})
