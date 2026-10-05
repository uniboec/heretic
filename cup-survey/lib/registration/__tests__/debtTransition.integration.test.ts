import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  verifyAdminSession: vi.fn().mockResolvedValue(true),
}))

import { prisma } from '../../prisma'
import { registrationStages } from '@/lib/config/tournament'
import { isIntegrationTestDatabase } from '../../db/integrationDatabaseUrl'
import { loadRegistrationSchedule } from '../schedule'
import { getEffectivePricePerDisciplineForUnpaidEntries } from '../stagePricing'
import { resolveEntryPriceForPaymentStage } from '../manualPayment'
import { getRegistrationKpi } from '../service'
import { PATCH as patchEntryRoute } from '@/app/api/admin/registrations/entries/[entryId]/route'
import { POST as markDebtRoute } from '@/app/api/admin/registrations/entries/[entryId]/mark-debt/route'
import { POST as confirmPaymentRoute } from '@/app/api/admin/registrations/entries/[entryId]/confirm-payment/route'

export let dbAvailable = false

beforeAll(async () => {
  if (process.env.REGISTRATION_INTEGRATION_TESTS !== '1') {
    dbAvailable = false
    return
  }
  if (!isIntegrationTestDatabase()) {
    dbAvailable = false
    return
  }
  try {
    await prisma.$queryRaw`SELECT 1`
    await loadRegistrationSchedule()
    dbAvailable = true
  } catch {
    dbAvailable = false
  }
})

beforeEach(async (ctx) => {
  if (!dbAvailable) {
    ctx.skip()
    return
  }

  await prisma.paymentProofEntry.deleteMany()
  await prisma.paymentProof.deleteMany()
  await prisma.athleteEntry.deleteMany()
  await prisma.athlete.deleteMany()
  await prisma.registrationDeviceAccess.deleteMany()
  await prisma.teamRegistration.deleteMany()
})

async function seedPaidEntryWithProof() {
  const registration = await prisma.teamRegistration.create({
    data: {
      publicNumber: 9001,
      clubName: 'Debt Test Club',
      city: 'Первоуральск',
      phone: '+79000000001',
      pricePerDiscipline: 1500,
      registrationStage: 'early',
      consentPersonalData: true,
      consentPublication: true,
      status: 'PAID',
      totalAmount: 1500,
      athletes: {
        create: {
          lastName: 'Тестов',
          firstName: 'Тест',
          middleName: null,
          birthDate: new Date('2012-05-15'),
          gender: 'male',
          weight: 66,
          rank: 'none',
          entries: {
            create: {
              discipline: 'tactic_control',
              experienceLevel: 'novice',
              ageDivisionId: 'm_juniors_1',
              weightCategoryId: 'm_w_66',
              price: 1500,
              paymentStatus: 'PAID',
              paymentStage: 'early',
              paidAt: new Date('2026-09-01T12:00:00+05:00'),
            },
          },
        },
      },
    },
    include: {
      athletes: { include: { entries: true } },
    },
  })

  const entry = registration.athletes[0]!.entries[0]!
  const proof = await prisma.paymentProof.create({
    data: {
      registrationId: registration.id,
      filePath: 'proofs/test.pdf',
      mimeType: 'application/pdf',
      fileSize: 100,
      amount: 1500,
      registrationStage: 'early',
      status: 'approved',
    },
  })
  const proofEntry = await prisma.paymentProofEntry.create({
    data: {
      paymentProofId: proof.id,
      entryId: entry.id,
    },
  })

  return { registration, entry, proof, proofEntry }
}

async function seedDebtEntry() {
  const registration = await prisma.teamRegistration.create({
    data: {
      publicNumber: 9003,
      clubName: 'Debt Only Club',
      city: 'Первоуральск',
      phone: '+79000000003',
      pricePerDiscipline: registrationStages.early.pricePerDiscipline,
      registrationStage: 'early',
      consentPersonalData: true,
      consentPublication: true,
      status: 'PAID',
      totalAmount: registrationStages.early.pricePerDiscipline,
      athletes: {
        create: {
          lastName: 'Долгов',
          firstName: 'Иван',
          middleName: null,
          birthDate: new Date('2012-05-15'),
          gender: 'male',
          weight: 66,
          rank: 'none',
          entries: {
            create: {
              discipline: 'tactic_control',
              experienceLevel: 'novice',
              ageDivisionId: 'm_juniors_1',
              weightCategoryId: 'm_w_66',
              price: registrationStages.early.pricePerDiscipline,
              paymentStatus: 'DEBT',
              paymentStage: 'early',
            },
          },
        },
      },
    },
    include: {
      athletes: { include: { entries: true } },
    },
  })

  return { registration, entry: registration.athletes[0]!.entries[0]! }
}

async function seedPublicParticipant(paymentStatus: 'DEBT' | 'ADMITTED_WITHOUT_PAYMENT', clubName: string) {
  return prisma.teamRegistration.create({
    data: {
      publicNumber: paymentStatus === 'DEBT' ? 9002 : 9004,
      clubName,
      city: 'Первоуральск',
      phone: '+79000000004',
      pricePerDiscipline: registrationStages.early.pricePerDiscipline,
      registrationStage: 'early',
      consentPersonalData: true,
      consentPublication: true,
      status: 'PAID',
      totalAmount: registrationStages.early.pricePerDiscipline,
      athletes: {
        create: {
          lastName: 'Публичный',
          firstName: paymentStatus === 'DEBT' ? 'Должник' : 'Допущен',
          middleName: null,
          birthDate: new Date('2012-05-15'),
          gender: 'male',
          weight: 66,
          rank: 'none',
          entries: {
            create: {
              discipline: 'tactic_control',
              experienceLevel: 'novice',
              ageDivisionId: 'm_juniors_1',
              weightCategoryId: 'm_w_66',
              price: registrationStages.early.pricePerDiscipline,
              paymentStatus,
              paymentStage: paymentStatus === 'DEBT' ? 'early' : null,
            },
          },
        },
      },
    },
  })
}

describe('PAID → UNPAID → DEBT transition', () => {
  it('preserves proof records and recalculates prices', async () => {
    const { registration, entry, proof, proofEntry } = await seedPaidEntryWithProof()

    const patchResponse = await patchEntryRoute(
      new Request('http://localhost/api/admin/registrations/entries/' + entry.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'UNPAID' }),
      }),
      { params: Promise.resolve({ entryId: entry.id }) },
    )
    expect(patchResponse.status).toBe(200)

    const unpaidEntry = await prisma.athleteEntry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(unpaidEntry.paymentStatus).toBe('UNPAID')
    expect(unpaidEntry.paidAt).toBeNull()
    expect(unpaidEntry.paymentStage).toBeNull()

    const proofAfterUnpaid = await prisma.paymentProof.findUniqueOrThrow({ where: { id: proof.id } })
    const proofEntryAfterUnpaid = await prisma.paymentProofEntry.findUniqueOrThrow({
      where: { id: proofEntry.id },
    })
    expect(proofAfterUnpaid.id).toBe(proof.id)
    expect(proofEntryAfterUnpaid.id).toBe(proofEntry.id)
    expect(unpaidEntry.price).toBe(getEffectivePricePerDisciplineForUnpaidEntries('early', null))

    const debtResponse = await markDebtRoute(
      new Request('http://localhost/api/admin/registrations/entries/' + entry.id + '/mark-debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStageId: 'early' }),
      }),
      { params: Promise.resolve({ entryId: entry.id }) },
    )
    expect(debtResponse.status).toBe(200)

    const debtEntry = await prisma.athleteEntry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(debtEntry.paymentStatus).toBe('DEBT')
    expect(debtEntry.paymentStage).toBe('early')
    expect(debtEntry.paidAt).toBeNull()
    expect(debtEntry.price).toBe(
      resolveEntryPriceForPaymentStage('early', debtEntry, null, []),
    )

    const proofAfterDebt = await prisma.paymentProof.findUniqueOrThrow({ where: { id: proof.id } })
    const proofEntryAfterDebt = await prisma.paymentProofEntry.findUniqueOrThrow({
      where: { id: proofEntry.id },
    })
    expect(proofAfterDebt.id).toBe(proof.id)
    expect(proofEntryAfterDebt.id).toBe(proofEntry.id)
  })

  it('rejects direct PATCH to DEBT', async () => {
    const { entry } = await seedPaidEntryWithProof()
    await prisma.athleteEntry.update({
      where: { id: entry.id },
      data: { paymentStatus: 'UNPAID', paidAt: null, paymentStage: null },
    })

    const response = await patchEntryRoute(
      new Request('http://localhost/api/admin/registrations/entries/' + entry.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'DEBT' }),
      }),
      { params: Promise.resolve({ entryId: entry.id }) },
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('REQUIRES_DEBT_CONFIRMATION')
  })
})

describe('DEBT follow-up transitions', () => {
  it('requires confirm-payment to move DEBT to PAID', async () => {
    const { entry } = await seedDebtEntry()

    const patchPaidResponse = await patchEntryRoute(
      new Request(`http://localhost/api/admin/registrations/entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'PAID' }),
      }),
      { params: Promise.resolve({ entryId: entry.id }) },
    )
    expect(patchPaidResponse.status).toBe(400)
    expect((await patchPaidResponse.json()).error).toBe('REQUIRES_PAYMENT_CONFIRMATION')

    const confirmResponse = await confirmPaymentRoute(
      new Request(`http://localhost/api/admin/registrations/entries/${entry.id}/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStageId: 'early',
          paidAt: '2026-09-20',
          withoutProof: true,
        }),
      }),
      { params: Promise.resolve({ entryId: entry.id }) },
    )
    expect(confirmResponse.status).toBe(200)

    const paidEntry = await prisma.athleteEntry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(paidEntry.paymentStatus).toBe('PAID')
    expect(paidEntry.paymentStage).toBe('early')
    expect(paidEntry.paidAt).not.toBeNull()
  })

  it('resets DEBT to UNPAID without touching historical proof links', async () => {
    const { entry } = await seedDebtEntry()
    const proof = await prisma.paymentProof.create({
      data: {
        registrationId: (await prisma.athleteEntry.findUniqueOrThrow({
          where: { id: entry.id },
          include: { athlete: { select: { registrationId: true } } },
        })).athlete.registrationId,
        filePath: 'proofs/debt-history.pdf',
        mimeType: 'application/pdf',
        fileSize: 100,
        amount: entry.price,
        registrationStage: 'early',
        status: 'approved',
      },
    })
    const proofEntry = await prisma.paymentProofEntry.create({
      data: { paymentProofId: proof.id, entryId: entry.id },
    })

    const response = await patchEntryRoute(
      new Request(`http://localhost/api/admin/registrations/entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'UNPAID' }),
      }),
      { params: Promise.resolve({ entryId: entry.id }) },
    )
    expect(response.status).toBe(200)

    const unpaidEntry = await prisma.athleteEntry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(unpaidEntry.paymentStatus).toBe('UNPAID')
    expect(unpaidEntry.paymentStage).toBeNull()
    expect(unpaidEntry.paidAt).toBeNull()
    expect(unpaidEntry.price).toBe(getEffectivePricePerDisciplineForUnpaidEntries('early', null))

    const proofAfter = await prisma.paymentProof.findUniqueOrThrow({ where: { id: proof.id } })
    const proofEntryAfter = await prisma.paymentProofEntry.findUniqueOrThrow({
      where: { id: proofEntry.id },
    })
    expect(proofAfter.id).toBe(proof.id)
    expect(proofEntryAfter.id).toBe(proofEntry.id)
  })

  it('rejects mark-debt with invalid stage without mutation', async () => {
    const { entry } = await seedDebtEntry()
    await prisma.athleteEntry.update({
      where: { id: entry.id },
      data: { paymentStatus: 'UNPAID', paymentStage: null },
    })

    const response = await markDebtRoute(
      new Request(`http://localhost/api/admin/registrations/entries/${entry.id}/mark-debt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStageId: 'invalid-stage-id' }),
      }),
      { params: Promise.resolve({ entryId: entry.id }) },
    )
    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('INVALID_STAGE')

    const unchanged = await prisma.athleteEntry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(unchanged.paymentStatus).toBe('UNPAID')
    expect(unchanged.paymentStage).toBeNull()
  })
})

describe('getRegistrationKpi integration', () => {
  it('includes DEBT prices in pending bucket for mixed registrations', async () => {
    await prisma.teamRegistration.create({
      data: {
        publicNumber: 9010,
        clubName: 'KPI Mixed Club',
        city: 'Первоуральск',
        phone: '+79000000010',
        pricePerDiscipline: 1000,
        registrationStage: 'early',
        consentPersonalData: true,
        consentPublication: true,
        status: 'PAID',
        totalAmount: 2750,
        athletes: {
          create: {
            lastName: 'KPI',
            firstName: 'Mixed',
            middleName: null,
            birthDate: new Date('2012-05-15'),
            gender: 'male',
            weight: 66,
            rank: 'none',
            entries: {
              create: [
                {
                  discipline: 'tactic_control',
                  experienceLevel: 'novice',
                  ageDivisionId: 'm_juniors_1',
                  weightCategoryId: 'm_w_66',
                  price: 1000,
                  paymentStatus: 'PAID',
                },
                {
                  discipline: 'close_control',
                  experienceLevel: 'novice',
                  ageDivisionId: 'm_juniors_1',
                  weightCategoryId: 'm_w_66',
                  price: 750,
                  paymentStatus: 'DEBT',
                  paymentStage: 'early',
                },
                {
                  discipline: 'tactic_control',
                  experienceLevel: 'experienced',
                  ageDivisionId: 'm_juniors_1',
                  weightCategoryId: 'm_w_70',
                  price: 500,
                  paymentStatus: 'ADMITTED_WITHOUT_PAYMENT',
                },
              ],
            },
          },
        },
      },
    })

    const kpi = await getRegistrationKpi()
    expect(kpi.confirmed).toBeGreaterThanOrEqual(1000)
    expect(kpi.admitted).toBeGreaterThanOrEqual(500)
    expect(kpi.pending).toBeGreaterThanOrEqual(750)
  })
})

describe('public participants API masking', () => {
  it('does not expose raw DEBT in tournament participants JSON', async () => {
    await seedPublicParticipant('DEBT', 'Public Debt Club')

    const { GET } = await import('@/app/api/tournament/participants/route')
    const response = await GET(new Request('http://localhost/api/tournament/participants'))
    expect(response.status).toBe(200)
    const json = await response.json()
    const participant = json.participants.find(
      (row: { clubName: string }) => row.clubName === 'Public Debt Club',
    )
    expect(participant).toBeTruthy()
    expect(participant.paymentStatus).toBe('PAID')
    expect(participant.entries.every((entry: { paymentStatus: string }) => entry.paymentStatus !== 'DEBT')).toBe(
      true,
    )
  })

  it('masks ADMITTED_WITHOUT_PAYMENT as PAID in tournament participants JSON', async () => {
    await seedPublicParticipant('ADMITTED_WITHOUT_PAYMENT', 'Public Admitted Club')

    const { GET } = await import('@/app/api/tournament/participants/route')
    const response = await GET(new Request('http://localhost/api/tournament/participants'))
    expect(response.status).toBe(200)
    const json = await response.json()
    const participant = json.participants.find(
      (row: { clubName: string }) => row.clubName === 'Public Admitted Club',
    )
    expect(participant).toBeTruthy()
    expect(participant.paymentStatus).toBe('PAID')
    expect(
      participant.entries.every(
        (entry: { paymentStatus: string }) => entry.paymentStatus !== 'ADMITTED_WITHOUT_PAYMENT',
      ),
    ).toBe(true)
    expect(participant.entries[0]?.paymentStatusLabel).toBe('Оплачен')
  })
})
