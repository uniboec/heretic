#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * One-off: add Очур-Оол Марк А. on prod (Tactic + Close, experienced, m_boys_3 ≤32 kg, PAID).
 * Usage (on server): npx tsx scripts/add-ochur-ool-mark-prod-once.ts
 */
import { prisma } from '../lib/prisma'
import { loadRegistrationSchedule } from '../lib/registration/schedule'
import { resolveRegistrationClub } from '../lib/registration/clubs'
import { listActiveCategoryDiscountRules } from '../lib/registration/categoryDiscounts'
import { applyClubDiscount, resolveEntryPrice } from '../lib/registration/pricing'
import { normalizePhoneToE164 } from '../lib/phone'
import { weightCategoryToDeclaredKg } from '../lib/registration/categoryRules'
import { syncRegistrationTotals } from '../lib/registration/entryPayment'
import { getDefaultPaidAtDate } from '../lib/registration/manualPayment'
import {
  bumpRegistrationRevisionInTransaction,
  runPostCommitBracketSync,
} from '../lib/registration/bracketImpactCoordinator'
import { collectCategoryKeysFromAthletes } from '../lib/registration/bracketAutoSync'
import { PRICE_HOLD_HOURS } from '../lib/config/tournament'
import { syncBracketDraft } from '../lib/brackets/generation/sync'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { setCategoriesPublicVisibility } from '../lib/brackets/generation/categoryVisibility'
import {
  getRegistrationCategoryKey,
  getRegistrationCategoryIdentity,
  getCategoryTitleFromKey,
} from '../lib/registration/categoryIdentity'

const ATHLETE = {
  lastName: 'Очур-Оол',
  firstName: 'Марк',
  middleName: 'Антонович',
  birthDate: '2017-07-27',
  gender: 'male' as const,
  rank: 'none' as const,
  clubName: 'АСЕ «Универсальные бойцы»',
  city: 'Первоуральск',
  phone: '89655257733',
  disciplineEntries: [
    {
      discipline: 'tactic_control' as const,
      ageDivisionId: 'm_boys_3',
      weightCategoryId: 'm_boys_3_w_le_32',
      experienceLevel: 'experienced' as const,
    },
    {
      discipline: 'close_control' as const,
      ageDivisionId: 'm_boys_3',
      weightCategoryId: 'm_boys_3_w_le_32',
      experienceLevel: 'experienced' as const,
    },
  ],
}

const STAGE_ID = 'late'

function matchesDisciplineEntry(
  entry: {
    discipline: string
    experienceLevel: string
    ageDivisionId: string | null
    weightCategoryId: string | null
  },
  target: (typeof ATHLETE.disciplineEntries)[number],
) {
  return (
    entry.discipline === target.discipline &&
    entry.experienceLevel === target.experienceLevel &&
    entry.ageDivisionId === target.ageDivisionId &&
    entry.weightCategoryId === target.weightCategoryId
  )
}

async function findExisting() {
  return prisma.athlete.findFirst({
    where: {
      lastName: { equals: ATHLETE.lastName, mode: 'insensitive' },
      firstName: { equals: ATHLETE.firstName, mode: 'insensitive' },
      middleName: { equals: ATHLETE.middleName, mode: 'insensitive' },
      registration: { status: { not: 'CANCELLED' } },
    },
    include: {
      entries: true,
      registration: {
        select: {
          id: true,
          publicNumber: true,
          phone: true,
          clubName: true,
          city: true,
          club: { select: { discountPercent: true } },
        },
      },
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

  const entryCreates = ATHLETE.disciplineEntries.map((entry) => ({
    discipline: entry.discipline,
    experienceLevel: entry.experienceLevel,
    ageDivisionId: entry.ageDivisionId,
    weightCategoryId: entry.weightCategoryId,
    price: resolveEntryPrice(
      basePricePerDiscipline,
      {
        discipline: entry.discipline,
        experienceLevel: entry.experienceLevel,
        ageDivisionId: entry.ageDivisionId,
      },
      discountRules,
      club.discountPercent,
    ),
    paymentStatus: 'UNPAID' as const,
  }))

  const totalAmount = entryCreates.reduce((sum, entry) => sum + entry.price, 0)

  const created = await prisma.teamRegistration.create({
    data: {
      clubId: club.id,
      clubName: club.name,
      city: club.city,
      phone,
      registrationStage: STAGE_ID,
      pricePerDiscipline,
      totalAmount,
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
          weight: weightCategoryToDeclaredKg(ATHLETE.disciplineEntries[0].weightCategoryId),
          entries: {
            create: entryCreates,
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
          gender: true,
          entries: {
            select: {
              id: true,
              discipline: true,
              experienceLevel: true,
              ageDivisionId: true,
              weightCategoryId: true,
            },
          },
        },
      },
    },
  })

  const athlete = created.athletes[0]!
  const categoryKeys = collectCategoryKeysFromAthletes([
    { gender: athlete.gender, entries: athlete.entries },
  ])
  await bumpRegistrationRevisionInTransaction()
  await runPostCommitBracketSync(categoryKeys)
  await syncRegistrationTotals(created.id)

  return {
    registrationId: created.id,
    publicNumber: created.publicNumber,
    athleteId: athlete.id,
    entries: athlete.entries,
    categoryKeys,
  }
}

async function confirmPaid(input: {
  entryId: string
  registrationId: string
  entry: {
    discipline: string
    experienceLevel: string
    ageDivisionId: string | null
  }
  clubDiscountPercent: number | null
}) {
  await loadRegistrationSchedule()
  const schedule = (await import('../lib/registration/schedule')).getRegistrationScheduleSync()
  const basePricePerDiscipline = schedule.stagesById[STAGE_ID]?.pricePerDiscipline ?? 2000
  const discountRules = await listActiveCategoryDiscountRules()
  const price = resolveEntryPrice(
    basePricePerDiscipline,
    {
      discipline: input.entry.discipline as 'tactic_control' | 'close_control',
      experienceLevel: input.entry.experienceLevel as 'experienced',
      ageDivisionId: input.entry.ageDivisionId,
    },
    discountRules,
    input.clubDiscountPercent,
  )
  const paidAt = new Date(`${getDefaultPaidAtDate(STAGE_ID)}T12:00:00+05:00`)

  await prisma.athleteEntry.update({
    where: { id: input.entryId },
    data: {
      paymentStatus: 'PAID',
      paymentStage: STAGE_ID,
      price,
      paidAt,
    },
  })
  await syncRegistrationTotals(input.registrationId)

  return { price, paymentStageId: STAGE_ID, paidAt: getDefaultPaidAtDate(STAGE_ID) }
}

async function syncCategories(categoryKeys: string[]) {
  const keys = [...new Set(categoryKeys)]
  const draft = await requireWorkingGeneration(prisma)
  const synced = await syncBracketDraft({
    draftId: draft.id,
    expectedVersion: draft.version,
    scope: 'all',
    categoryKeys: keys,
    afterRegistrationChange: true,
  })

  for (const categoryKey of keys) {
    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey,
      visible: true,
    })
  }

  return synced.draft.version
}

async function verify(entryIds: string[], categoryKeys: string[]) {
  const entries = await prisma.athleteEntry.findMany({
    where: { id: { in: entryIds } },
    include: {
      athlete: {
        include: {
          registration: { select: { publicNumber: true, registrationStage: true } },
        },
      },
    },
  })

  const gen = await requireWorkingGeneration(prisma)
  const brackets = await Promise.all(
    entryIds.map(async (entryId, index) => {
      const categoryKey = categoryKeys[index]!
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
        entryId,
        categoryKey,
        categoryTitle: getCategoryTitleFromKey(categoryKey),
        entry: entries.find((item) => item.id === entryId)
          ? {
              discipline: entries.find((item) => item.id === entryId)!.discipline,
              paymentStatus: entries.find((item) => item.id === entryId)!.paymentStatus,
              paymentStage: entries.find((item) => item.id === entryId)!.paymentStage,
              price: entries.find((item) => item.id === entryId)!.price,
            }
          : null,
        bracket: participant
          ? {
              participantCount: participant.draw.participants.length,
              visible: participant.draw.publicationState?.visible ?? false,
              boutsReleased: participant.draw.publicationState?.boutsReleased ?? false,
              autoSystemId: participant.draw.autoSystemId,
            }
          : null,
      }
    }),
  )

  const first = entries[0]
  return {
    publicNumber: first?.athlete.registration.publicNumber,
    registrationStage: first?.athlete.registration.registrationStage,
    disciplines: brackets,
  }
}

async function ensurePaidForEntries(input: {
  registrationId: string
  clubDiscountPercent: number | null
  athlete: {
    gender: string
    entries: Array<{
      id: string
      discipline: string
      experienceLevel: string
      ageDivisionId: string | null
      weightCategoryId: string | null
      paymentStatus: string
    }>
  }
}) {
  const payments: Array<{
    entryId: string
    discipline: string
    categoryKey: string
    payment?: { price: number; paymentStageId: string; paidAt: string }
    skipped?: string
  }> = []

  for (const target of ATHLETE.disciplineEntries) {
    const entry = input.athlete.entries.find((item) => matchesDisciplineEntry(item, target))
    if (!entry) throw new Error(`Missing entry for ${target.discipline}`)

    const categoryKey = getRegistrationCategoryKey(
      getRegistrationCategoryIdentity(target, { gender: input.athlete.gender })!,
    )

    if (entry.paymentStatus === 'PAID') {
      payments.push({
        entryId: entry.id,
        discipline: entry.discipline,
        categoryKey,
        skipped: 'already_paid',
      })
      continue
    }

    const payment = await confirmPaid({
      entryId: entry.id,
      registrationId: input.registrationId,
      entry,
      clubDiscountPercent: input.clubDiscountPercent,
    })
    payments.push({
      entryId: entry.id,
      discipline: entry.discipline,
      categoryKey,
      payment,
    })
  }

  return payments
}

async function main() {
  const existing = await findExisting()
  if (existing) {
    const payments = await ensurePaidForEntries({
      registrationId: existing.registration.id,
      clubDiscountPercent: existing.registration.club?.discountPercent ?? null,
      athlete: existing,
    })
    const categoryKeys = payments.map((item) => item.categoryKey)
    const bracketVersion = await syncCategories(categoryKeys)

    console.log(
      JSON.stringify(
        {
          ok: true,
          action: 'already_exists',
          athleteId: existing.id,
          publicNumber: existing.registration.publicNumber,
          payments,
          bracketVersion,
          verify: await verify(
            payments.map((item) => item.entryId),
            categoryKeys,
          ),
        },
        null,
        2,
      ),
    )
    return
  }

  const created = await createRegistration()
  const athlete = await prisma.athlete.findUnique({
    where: { id: created.athleteId },
    include: {
      entries: true,
      registration: { include: { club: true } },
    },
  })
  if (!athlete) throw new Error('Created athlete not found')

  const payments = await ensurePaidForEntries({
    registrationId: created.registrationId,
    clubDiscountPercent: athlete.registration.club?.discountPercent ?? null,
    athlete,
  })
  const categoryKeys = created.categoryKeys
  const bracketVersion = await syncCategories(categoryKeys)

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'created',
        publicNumber: created.publicNumber,
        registrationId: created.registrationId,
        athleteId: created.athleteId,
        payments,
        bracketVersion,
        verify: await verify(
          payments.map((item) => item.entryId),
          categoryKeys,
        ),
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
