#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * One-off: add Мальцев М.В. on prod after registration closed.
 * Usage (on server): npx tsx scripts/add-maltsev-prod-once.ts
 */
import { prisma } from '../lib/prisma'
import { loadRegistrationSchedule } from '../lib/registration/schedule'
import { resolveRegistrationClub } from '../lib/registration/clubs'
import { listActiveCategoryDiscountRules } from '../lib/registration/categoryDiscounts'
import { applyClubDiscount, resolveEntryPrice } from '../lib/registration/pricing'
import { normalizePhoneToE164 } from '../lib/phone'
import { weightCategoryToDeclaredKg } from '../lib/registration/categoryRules'
import { syncRegistrationTotals } from '../lib/registration/entryPayment'
import { markEntryDebtAsAdmin } from '../lib/registration/manualPayment'
import { bumpRegistrationRevisionInTransaction, runPostCommitBracketSync } from '../lib/registration/bracketImpactCoordinator'
import { collectCategoryKeysFromAthletes } from '../lib/registration/bracketAutoSync'
import { PRICE_HOLD_HOURS } from '../lib/config/tournament'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { setCategoriesPublicVisibility } from '../lib/brackets/generation/categoryVisibility'
import { entryCategoryKey } from '../lib/registration/entryPayment'

const ATHLETE = {
  lastName: 'Мальцев',
  firstName: 'Мирослав',
  middleName: 'Вячеславович',
  birthDate: '2014-03-06',
  gender: 'male' as const,
  rank: 'none' as const,
  clubName: 'АСЕ «Универсальные бойцы»',
  city: 'Первоуральск',
  phone: '89655257733',
  disciplineEntry: {
    discipline: 'close_control' as const,
    ageDivisionId: 'm_youths_2',
    weightCategoryId: 'm_youths_2_w_le_61',
    experienceLevel: 'novice' as const,
  },
}

const STAGE_ID = 'late'

async function findExisting() {
  const phone = normalizePhoneToE164(ATHLETE.phone) ?? ATHLETE.phone
  return prisma.athlete.findFirst({
    where: {
      OR: [
        { registration: { phone: { contains: '9655257733' } } },
        {
          lastName: { equals: ATHLETE.lastName, mode: 'insensitive' },
          firstName: { equals: ATHLETE.firstName, mode: 'insensitive' },
        },
      ],
      registration: { status: { not: 'CANCELLED' } },
    },
    include: {
      entries: true,
      registration: { select: { publicNumber: true, phone: true, clubName: true, city: true } },
    },
  })
}

async function createRegistration() {
  await loadRegistrationSchedule()
  const schedule = (await import('../lib/registration/schedule')).getRegistrationScheduleSync()
  const basePricePerDiscipline = schedule.stagesById[STAGE_ID]?.pricePerDiscipline ?? 2000
  const discountRules = await listActiveCategoryDiscountRules()
  const phone = normalizePhoneToE164(ATHLETE.phone) ?? ATHLETE.phone
  const club = await resolveRegistrationClub({
    clubName: ATHLETE.clubName,
    city: ATHLETE.city,
  })
  const pricePerDiscipline = applyClubDiscount(basePricePerDiscipline, club.discountPercent)
  const now = new Date()
  const priceHeldUntil = new Date(now.getTime() + PRICE_HOLD_HOURS * 60 * 60 * 1000)
  const entry = ATHLETE.disciplineEntry
  const price = resolveEntryPrice(
    basePricePerDiscipline,
    {
      discipline: entry.discipline,
      experienceLevel: entry.experienceLevel,
      ageDivisionId: entry.ageDivisionId,
    },
    discountRules,
    club.discountPercent,
  )

  const created = await prisma.teamRegistration.create({
    data: {
      clubId: club.id,
      clubName: club.name,
      city: club.city,
      phone,
      registrationStage: STAGE_ID,
      pricePerDiscipline,
      totalAmount: price,
      status: 'AWAITING_PAYMENT',
      priceHeldUntil,
      consentPersonalData: true,
      consentPublication: true,
      athletes: {
        create: {
          lastName: ATHLETE.lastName,
          firstName: ATHLETE.firstName,
          middleName: ATHLETE.middleName,
          birthDate: new Date(`${ATHLETE.birthDate}T12:00:00`),
          gender: ATHLETE.gender,
          rank: ATHLETE.rank,
          weight: weightCategoryToDeclaredKg(entry.weightCategoryId),
          entries: {
            create: [
              {
                discipline: entry.discipline,
                experienceLevel: entry.experienceLevel,
                ageDivisionId: entry.ageDivisionId,
                weightCategoryId: entry.weightCategoryId,
                price,
                paymentStatus: 'UNPAID',
              },
            ],
          },
        },
      },
    },
    select: {
      id: true,
      publicNumber: true,
      athletes: {
        select: {
          id: true,
          entries: { select: { id: true } },
        },
      },
    },
  })

  const categoryKeys = collectCategoryKeysFromAthletes([
    { gender: ATHLETE.gender, entries: [entry] },
  ])
  await bumpRegistrationRevisionInTransaction()
  await runPostCommitBracketSync(categoryKeys)
  await syncRegistrationTotals(created.id)

  return {
    registrationId: created.id,
    publicNumber: created.publicNumber,
    athleteId: created.athletes[0]!.id,
    entryId: created.athletes[0]!.entries[0]!.id,
    categoryKeys,
  }
}

async function syncCategory(categoryKeys: string[]) {
  const draft = await requireWorkingGeneration(prisma)
  const synced = await syncBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'all',
    categoryKeys,
    afterRegistrationChange: true,
  })

  for (const categoryKey of categoryKeys) {
    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey,
      visible: true,
    })
  }

  return synced.draft.version
}

async function verify(entryId: string, categoryKey: string) {
  const entry = await prisma.athleteEntry.findUnique({
    where: { id: entryId },
    include: {
      athlete: {
        include: {
          registration: { select: { publicNumber: true, registrationStage: true } },
        },
      },
    },
  })
  const gen = await requireWorkingGeneration(prisma)
  const participant = await prisma.bracketDrawParticipant.findFirst({
    where: { entryId, draw: { generationId: gen.id, categoryKey } },
    include: {
      draw: {
        include: {
          participants: true,
          publicationState: true,
        },
      },
    },
  })

  return {
    entry: entry
      ? {
          paymentStatus: entry.paymentStatus,
          paymentStage: entry.paymentStage,
          price: entry.price,
          publicNumber: entry.athlete.registration.publicNumber,
          registrationStage: entry.athlete.registration.registrationStage,
        }
      : null,
    bracket: participant
      ? {
          categoryKey,
          participantCount: participant.draw.participants.length,
          visible: participant.draw.publicationState?.visible ?? false,
          boutsReleased: participant.draw.publicationState?.boutsReleased ?? false,
          autoSystemId: participant.draw.autoSystemId,
        }
      : null,
  }
}

async function main() {
  const existing = await findExisting()
  if (existing) {
    const entry = existing.entries.find((e) => e.discipline === 'close_control') ?? existing.entries[0]
    if (!entry) throw new Error('Existing athlete has no entries')
    const categoryKey = entryCategoryKey(entry)
    console.log(
      JSON.stringify(
        {
          ok: true,
          action: 'already_exists',
          athleteId: existing.id,
          entryId: entry.id,
          publicNumber: existing.registration.publicNumber,
          paymentStatus: entry.paymentStatus,
          verify: await verify(entry.id, categoryKey),
        },
        null,
        2,
      ),
    )
    return
  }

  const created = await createRegistration()
  const debt = await markEntryDebtAsAdmin({
    entryId: created.entryId,
    paymentStageId: STAGE_ID,
  })
  const categoryKey = created.categoryKeys[0]!
  const bracketVersion = await syncCategory(created.categoryKeys)
  const result = {
    ok: true,
    action: 'created',
    publicNumber: created.publicNumber,
    registrationId: created.registrationId,
    athleteId: created.athleteId,
    entryId: created.entryId,
    categoryKey,
    debt,
    bracketVersion,
    verify: await verify(created.entryId, categoryKey),
  }
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
