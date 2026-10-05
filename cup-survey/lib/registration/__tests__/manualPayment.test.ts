import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registrationStages } from '@/lib/config/tournament'
import {
  getDefaultManualPaymentStageId,
  getDefaultPaidAtDate,
  getGraceEligiblePaymentStageId,
  getManualPaymentStageOptions,
  isWithinGraceAfterStage,
} from '../manualPayment'

vi.mock('../time', () => ({
  getServerNow: () => new Date('2026-09-22T12:00:00+05:00'),
  getCurrentRegistrationStage: vi.fn(),
}))

vi.mock('../schedule', () => ({
  getRegistrationScheduleSync: () => ({
    stages: [registrationStages.early, registrationStages.regular, registrationStages.late],
    stagesById: registrationStages,
  }),
}))

import { getCurrentRegistrationStage } from '../time'

describe('manualPayment', () => {
  beforeEach(() => {
    vi.mocked(getCurrentRegistrationStage).mockReturnValue('regular')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('detects grace eligibility for early registrations during regular stage', () => {
    expect(
      getGraceEligiblePaymentStageId('early', 'UNPAID'),
    ).toBe('early')
    expect(isWithinGraceAfterStage('early')).toBe(true)
  })

  it('does not offer grace for already paid entries', () => {
    expect(getGraceEligiblePaymentStageId('early', 'PAID')).toBeNull()
  })

  it('offers all schedule stages for manual payment selection', () => {
    expect(getManualPaymentStageOptions('early').map((stage) => stage.id)).toEqual([
      'early',
      'regular',
      'late',
    ])
    expect(getManualPaymentStageOptions('regular').map((stage) => stage.id)).toEqual([
      'early',
      'regular',
      'late',
    ])
  })

  it('offers all schedule stages regardless of legacy registration stage id', () => {
    expect(getManualPaymentStageOptions('main').map((stage) => stage.id)).toEqual([
      'early',
      'regular',
      'late',
    ])
  })

  it('defaults manual confirmation to grace stage when available', () => {
    expect(getDefaultManualPaymentStageId('early', 'UNPAID')).toBe('early')
    expect(getDefaultPaidAtDate('early')).toBe('2026-09-21')
  })
})
