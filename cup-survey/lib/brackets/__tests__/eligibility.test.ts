import { describe, expect, it, vi } from 'vitest'

vi.mock('../../prisma', () => ({
  prisma: {
    teamRegistration: { findMany: vi.fn().mockResolvedValue([]) },
    bracketEntryPlacement: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { loadEligibleEntries } from '../core/eligibility'
import { prisma } from '../../prisma'

describe('loadEligibleEntries payment status', () => {
  it('treats PAYMENT_REVIEW as paid when includePaid is enabled', async () => {
    vi.mocked(prisma.teamRegistration.findMany).mockResolvedValue([
      {
        status: 'PAID',
        clubId: 'club-1',
        club: { name: 'Club', city: 'City' },
        clubName: 'Club',
        city: 'City',
        publicNumber: 1,
        athletes: [
          {
            gender: 'male',
            rank: 'none',
            lastName: 'Иванов',
            firstName: 'Иван',
            middleName: null,
            entries: [
              {
                id: 'entry-1',
                paymentStatus: 'PAYMENT_REVIEW',
                discipline: 'tactic_control',
                experienceLevel: 'novice',
                ageDivisionId: 'm_juniors_1',
                weightCategoryId: 'm_w_66',
              },
            ],
          },
        ],
      },
    ] as never)

    const eligible = await loadEligibleEntries({ includePaid: true, includeUnpaid: false })
    expect(eligible).toHaveLength(1)
    expect(eligible[0]?.entryId).toBe('entry-1')
  })

  it('treats DEBT as paid when includePaid is enabled', async () => {
    vi.mocked(prisma.teamRegistration.findMany).mockResolvedValue([
      {
        status: 'PAID',
        clubId: 'club-1',
        club: { name: 'Club', city: 'City' },
        clubName: 'Club',
        city: 'City',
        publicNumber: 1,
        athletes: [
          {
            gender: 'male',
            rank: 'none',
            lastName: 'Иванов',
            firstName: 'Иван',
            middleName: null,
            entries: [
              {
                id: 'entry-debt',
                paymentStatus: 'DEBT',
                discipline: 'tactic_control',
                experienceLevel: 'novice',
                ageDivisionId: 'm_juniors_1',
                weightCategoryId: 'm_w_66',
              },
            ],
          },
        ],
      },
    ] as never)

    const eligible = await loadEligibleEntries({ includePaid: true, includeUnpaid: false })
    expect(eligible).toHaveLength(1)
    expect(eligible[0]?.entryId).toBe('entry-debt')
  })
})
