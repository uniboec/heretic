import { describe, expect, it } from 'vitest'
import {
  categoryEligibleForAwardsSchedule,
  categoryRequiresBouts,
} from '../categoryRequiresBouts'

describe('categoryRequiresBouts', () => {
  it('returns false for champion singleton', () => {
    expect(
      categoryRequiresBouts({
        status: 'ACTIVE',
        autoSystemId: 'champion',
        systemOverride: null,
        participantCount: 1,
      }),
    ).toBe(false)
  })

  it('returns false for olympic with one participant', () => {
    expect(
      categoryRequiresBouts({
        status: 'ACTIVE',
        autoSystemId: 'olympic',
        systemOverride: null,
        participantCount: 1,
      }),
    ).toBe(false)
  })

  it('returns true for olympic with two participants', () => {
    expect(
      categoryRequiresBouts({
        status: 'ACTIVE',
        autoSystemId: 'olympic',
        systemOverride: null,
        participantCount: 2,
      }),
    ).toBe(true)
  })

  it('returns false for inactive categories', () => {
    expect(
      categoryRequiresBouts({
        status: 'INACTIVE',
        autoSystemId: 'olympic',
        systemOverride: null,
        participantCount: 2,
      }),
    ).toBe(false)
  })
})

describe('categoryEligibleForAwardsSchedule', () => {
  it('returns true for champion singleton', () => {
    expect(
      categoryEligibleForAwardsSchedule({
        status: 'ACTIVE',
        autoSystemId: 'champion',
        systemOverride: null,
        participantCount: 1,
      }),
    ).toBe(true)
  })

  it('returns false for olympic pairs', () => {
    expect(
      categoryEligibleForAwardsSchedule({
        status: 'ACTIVE',
        autoSystemId: 'olympic',
        systemOverride: null,
        participantCount: 2,
      }),
    ).toBe(false)
  })

  it('returns false for inactive singleton', () => {
    expect(
      categoryEligibleForAwardsSchedule({
        status: 'INACTIVE',
        autoSystemId: 'champion',
        systemOverride: null,
        participantCount: 1,
      }),
    ).toBe(false)
  })
})
