import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registrationStages } from '@/lib/config/tournament'
import {
  getEffectiveBasePriceForUnpaidEntries,
  getEffectivePricePerDisciplineForUnpaidEntries,
  resetUnpaidStagePricingSync,
} from '../stagePricing'

vi.mock('../time', () => ({
  getServerNow: () => new Date('2026-09-22T12:00:00+05:00'),
  getCurrentRegistrationStage: vi.fn(),
}))

vi.mock('../schedule', () => ({
  loadRegistrationSchedule: vi.fn(async () => undefined),
  getRegistrationScheduleSync: () => ({
    stagesById: {
      early: registrationStages.early,
      regular: registrationStages.regular,
      late: registrationStages.late,
    },
  }),
}))

import { getCurrentRegistrationStage } from '../time'

describe('stagePricing', () => {
  beforeEach(() => {
    resetUnpaidStagePricingSync()
    vi.mocked(getCurrentRegistrationStage).mockReturnValue('regular')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('uses current stage price for unpaid entries instead of registration stage', () => {
    expect(getEffectiveBasePriceForUnpaidEntries('early')).toBe(1800)
    expect(getEffectivePricePerDisciplineForUnpaidEntries('early', null)).toBe(1800)
  })

  it('falls back to registration stage when registration is closed', () => {
    vi.mocked(getCurrentRegistrationStage).mockReturnValue(null)

    expect(getEffectiveBasePriceForUnpaidEntries('early')).toBe(1500)
    expect(getEffectiveBasePriceForUnpaidEntries('regular')).toBe(1800)
  })

  it('applies club discount to the current stage base price', () => {
    expect(getEffectivePricePerDisciplineForUnpaidEntries('early', 10)).toBe(1620)
  })
})
