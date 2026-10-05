import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registrationStages } from '@/lib/config/tournament'

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

const prismaMock = vi.hoisted(() => ({
  athleteEntry: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  teamRegistration: {
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('../../prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('../categoryDiscounts', () => ({
  listActiveCategoryDiscountRules: vi.fn().mockResolvedValue([]),
}))

vi.mock('../entryPayment', () => ({
  syncRegistrationTotals: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../bracketImpactCoordinator', () => ({
  withBracketImpactAfterCommit: vi.fn(async (fn: (tx?: typeof prismaMock) => Promise<unknown>) =>
    fn(prismaMock),
  ),
  bumpRegistrationRevisionInTransaction: vi.fn().mockResolvedValue(BigInt(1)),
  runPostCommitBracketSync: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../adminImpact', () => ({
  fingerprintMarkDebt: vi.fn(() => 'debt-fingerprint'),
}))

vi.mock('../bracketAutoSync', () => ({
  loadCategoryKeysForRegistration: vi.fn().mockResolvedValue([]),
  loadCategoryKeysForEntry: vi.fn().mockResolvedValue(['tactic_control:novice:m_juniors_1:m_juniors_1_w_le_71']),
}))

import { getCurrentRegistrationStage } from '../time'
import { markEntryDebtAsAdmin } from '../manualPayment'

const unpaidEntryFixture = {
  id: 'entry-1',
  paymentStatus: 'UNPAID' as const,
  paymentProofLinks: [] as Array<{ paymentProof: { status: string } }>,
  discipline: 'tactic_control',
  experienceLevel: 'novice',
  ageDivisionId: 'm_juniors_1',
  athlete: {
    registration: {
      id: 'reg-1',
      registrationStage: 'early',
      adminComment: null as string | null,
      club: { discountPercent: null as number | null },
    },
  },
}

describe('markEntryDebtAsAdmin', () => {
  beforeEach(() => {
    vi.mocked(getCurrentRegistrationStage).mockReturnValue('regular')
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<void>) =>
      fn(prismaMock),
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects PAID source without mutating entry', async () => {
    prismaMock.athleteEntry.findUnique.mockResolvedValue({
      id: 'entry-1',
      paymentStatus: 'PAID',
      paymentProofLinks: [],
      discipline: 'tactic_control',
      experienceLevel: 'novice',
      ageDivisionId: 'm_juniors_1',
      athlete: {
        registration: {
          id: 'reg-1',
          registrationStage: 'early',
          adminComment: null,
          club: { discountPercent: null },
        },
      },
    })

    await expect(
      markEntryDebtAsAdmin({ entryId: 'entry-1', paymentStageId: 'early' }),
    ).rejects.toThrow('INVALID_TRANSITION')
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('rejects entries with pending proof', async () => {
    prismaMock.athleteEntry.findUnique.mockResolvedValue({
      id: 'entry-1',
      paymentStatus: 'PAYMENT_REVIEW',
      paymentProofLinks: [{ paymentProof: { status: 'pending' } }],
      discipline: 'tactic_control',
      experienceLevel: 'novice',
      ageDivisionId: 'm_juniors_1',
      athlete: {
        registration: {
          id: 'reg-1',
          registrationStage: 'early',
          adminComment: null,
          club: { discountPercent: null },
        },
      },
    })

    await expect(
      markEntryDebtAsAdmin({ entryId: 'entry-1', paymentStageId: 'early' }),
    ).rejects.toThrow('PENDING_PROOF')
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('marks UNPAID entry as DEBT with stage snapshot', async () => {
    prismaMock.athleteEntry.findUnique.mockResolvedValue(unpaidEntryFixture)

    const result = await markEntryDebtAsAdmin({ entryId: 'entry-1', paymentStageId: 'early' })

    expect(prismaMock.athleteEntry.update).toHaveBeenCalledOnce()
    expect(prismaMock.athleteEntry.update).toHaveBeenCalledWith({
      where: { id: 'entry-1' },
      data: {
        paymentStatus: 'DEBT',
        paymentStage: 'early',
        price: registrationStages.early.pricePerDiscipline,
        paidAt: null,
      },
    })
    expect(result).toEqual({
      price: registrationStages.early.pricePerDiscipline,
      paymentStageId: 'early',
    })
  })

  it('rejects invalid stage without mutating entry', async () => {
    prismaMock.athleteEntry.findUnique.mockResolvedValue(unpaidEntryFixture)

    await expect(
      markEntryDebtAsAdmin({ entryId: 'entry-1', paymentStageId: 'nonexistent-stage' }),
    ).rejects.toThrow('INVALID_STAGE')
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
