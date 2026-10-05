import { describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  teamRegistration: {
    findMany: vi.fn(),
  },
}))

vi.mock('../../prisma', () => ({
  prisma: prismaMock,
}))

import { getRegistrationKpi } from '../service'

describe('getRegistrationKpi debt buckets', () => {
  it('maps PAID, ADMITTED_WITHOUT_PAYMENT and DEBT to confirmed/admitted/pending', async () => {
    prismaMock.teamRegistration.findMany.mockResolvedValue([
      {
        athletes: [
          {
            entries: [
              { price: 1000, paymentStatus: 'PAID' },
              { price: 500, paymentStatus: 'ADMITTED_WITHOUT_PAYMENT' },
              { price: 750, paymentStatus: 'DEBT' },
              { price: 200, paymentStatus: 'UNPAID' },
            ],
          },
        ],
      },
    ])

    const kpi = await getRegistrationKpi()

    expect(kpi.confirmed).toBe(1000)
    expect(kpi.admitted).toBe(500)
    expect(kpi.pending).toBe(950)
    expect(kpi.charged).toBe(2450)
    expect(kpi.entries).toBe(4)
  })
})
