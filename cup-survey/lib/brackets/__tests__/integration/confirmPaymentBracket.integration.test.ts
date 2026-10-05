import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../../prisma'
import { confirmEntryPaymentAsAdmin } from '../../../registration/manualPayment'
import {
  CAT_A,
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  ensureBracketDefaults,
  resetRegistrationRevision,
  seedBoutsPageSetting,
  syncRedrawAll,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

async function seedUnpaidEntry() {
  const registration = await prisma.teamRegistration.create({
    data: {
      clubName: 'Danilov Club',
      city: 'Test City',
      phone: `+7905${String(Date.now()).slice(-7)}`,
      registrationStage: 'main',
      pricePerDiscipline: 1000,
      totalAmount: 1000,
      consentPersonalData: true,
      consentPublication: true,
      status: 'AWAITING_PAYMENT',
      athletes: {
        create: {
          lastName: 'Данилов',
          firstName: 'Иван',
          birthDate: new Date('2012-03-15'),
          gender: 'male',
          entries: {
            create: {
              discipline: 'tactic_control',
              experienceLevel: 'beginner',
              ageDivisionId: 'm_juniors_1',
              weightCategoryId: 'w_66',
              price: 1000,
              paymentStatus: 'UNPAID',
            },
          },
        },
      },
    },
    include: { athletes: { include: { entries: true } } },
  })
  return {
    registrationId: registration.id,
    entryId: registration.athletes[0]!.entries[0]!.id,
  }
}

describe('confirm payment adds athlete to brackets', () => {
  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  useIntegrationDb()

  beforeEach(async () => {
    if (!dbAvailable) return
    await seedBoutsPageSetting()
    await ensureBracketDefaults()
    await prisma.bracketPageSetting.update({
      where: { id: 'default' },
      data: { includePaid: true, includeUnpaid: false },
    })
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    if (!dbAvailable) return
    await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
    generationIds.length = 0
    registrationIds.length = 0
    entryIds.length = 0
    await resetRegistrationRevision()
  })

  it('creates draw participant when sole UNPAID entry is confirmed as PAID', async () => {
    const seeded = await seedUnpaidEntry()
    registrationIds.push(seeded.registrationId)
    entryIds.push(seeded.entryId)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const drawBefore = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id, categoryKey: CAT_A },
    })
    expect(drawBefore).toBeNull()

    await confirmEntryPaymentAsAdmin({
      entryId: seeded.entryId,
      paymentStageId: 'early',
      paidAt: '2026-09-20',
      withoutProof: true,
    })

    const participant = await prisma.bracketDrawParticipant.findFirst({
      where: {
        entryId: seeded.entryId,
        draw: { generationId: ready.draft.id, categoryKey: CAT_A, status: 'ACTIVE' },
      },
    })
    expect(participant).not.toBeNull()
  })

  it('keeps entry UNPAID when released category requires impact confirm', async () => {
    const seeded = await seedUnpaidEntry()
    registrationIds.push(seeded.registrationId)
    entryIds.push(seeded.entryId)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    await confirmEntryPaymentAsAdmin({
      entryId: seeded.entryId,
      paymentStageId: 'early',
      paidAt: '2026-09-20',
      withoutProof: true,
    })

    const draw = await prisma.bracketCategoryDraw.findFirstOrThrow({
      where: { generationId: ready.draft.id, categoryKey: CAT_A, status: 'ACTIVE' },
    })

    await prisma.bracketPublicationState.update({
      where: { categoryKey: CAT_A },
      data: {
        boutsReleased: true,
        publishedDrawId: draw.id,
      },
    })

    const second = await seedUnpaidEntry()
    registrationIds.push(second.registrationId)
    entryIds.push(second.entryId)

    const { DestructiveConfirmRequiredError } = await import('../../live/errors')
    await expect(
      confirmEntryPaymentAsAdmin({
        entryId: second.entryId,
        paymentStageId: 'early',
        paidAt: '2026-09-21',
        withoutProof: true,
      }),
    ).rejects.toBeInstanceOf(DestructiveConfirmRequiredError)

    const entry = await prisma.athleteEntry.findUniqueOrThrow({ where: { id: second.entryId } })
    expect(entry.paymentStatus).toBe('UNPAID')
  })
})
