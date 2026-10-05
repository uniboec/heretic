import { prisma } from '../prisma'
import type { Prisma } from '@prisma/client'
import type { RegistrationBody } from '../validation/registrationSchema'
import { listActiveCategoryDiscountRules } from './categoryDiscounts'
import { recalculateUnpaidEntryPricesForRegistration } from './categoryDiscounts'
import {
  applyClubDiscount,
  resolveEntryPrice,
  type CategoryDiscountRuleLike,
} from './pricing'
import { loadRegistrationSchedule } from './schedule'
import { getCurrentRegistrationStage, getServerNow } from './time'
import { assertUserRegistrationChangesAllowed } from '../brackets/live/policyD'
import { PRICE_HOLD_HOURS } from '../config/tournament'
import { normalizeEmail } from '../email'
import { normalizePhoneToE164 } from '../phone'
import {
  getParticipantListStatusLabel,
  getPublicEntryPaymentStatusLabel,
  getEntryPaymentKpiBucket,
  isConfirmedForPublicList,
  toPublicEntryPaymentStatus,
  type EntryPaymentStatus,
} from './status'
import { aggregateEntryPaymentStatus, matchesPublicPaidPaymentFilter } from './entryPayment'
import type { PublicAthleteRow } from './categories'
import { TOURNAMENT_SCOPE_ID } from '../config/tournament'
import { hasWeighInFromCheckRecord } from '../mandate/computeWeightStatus'
import { serializeMandateCheckRecord } from '../mandate/patchMandateCheck'
import { getClubById, getRegistrationPricePerDiscipline, resolveRegistrationClub } from './clubs'
import { grantDeviceAccess, hashEditCode } from './editAccess'
import { getAthleteAgeOnTournamentDate, weightCategoryToDeclaredKg } from './categoryRules'
import { serializeAthleteEntries } from './entrySerialization'
import type { RegistrationCreateBody } from '../validation/registrationCreateSchema'
import type { AthleteBody, StandaloneAthleteBody } from '../validation/registrationSchema'
import { entryCategoryKey, syncRegistrationTotals } from './entryPayment'
import { getEffectiveBasePriceForUnpaidEntries } from './stagePricing'
import { isLockedEntryStatus, RegistrationEditError, validateRegistrationEdit } from './editRules'
import type { DisciplineEntryBody } from '../validation/registrationSchema'
import {
  athleteIdentityKey,
  participantSearchMatchesQuery,
  formatAthleteFullName,
} from './athleteName'

const athleteOrderBy = [{ lastName: 'asc' as const }, { firstName: 'asc' as const }]

function athleteNameFields(athlete: {
  lastName: string
  firstName: string
  middleName?: string | null
}) {
  return {
    lastName: athlete.lastName.trim(),
    firstName: athlete.firstName.trim(),
    middleName: athlete.middleName?.trim() || null,
  }
}

export class RegistrationClosedError extends Error {
  code = 'REGISTRATION_CLOSED'
}

export async function countActiveAthletes(): Promise<number> {
  const rows = await prisma.athlete.count({
    where: {
      registration: {
        status: { not: 'CANCELLED' },
      },
    },
  })
  return rows
}

export class RegistrationLimitError extends Error {
  code = 'REGISTRATION_LIMIT'

  constructor(public readonly maxAthletes: number | null = null) {
    super('REGISTRATION_LIMIT')
  }
}

function athleteEntryPreserveKey(
  athlete: { lastName: string; firstName: string; middleName?: string | null; birthDate: string },
  entry: DisciplineEntryBody,
): string {
  return `${athleteIdentityKey(athlete, athlete.birthDate)}:${entryCategoryKey(entry)}`
}

function buildPreservedEntryMap(
  athletes: Array<{
    lastName: string
    firstName: string
    middleName: string | null
    birthDate: Date
    entries: Array<{
      discipline: string
      experienceLevel: string
      ageDivisionId: string | null
      weightCategoryId: string | null
      price: number
      paymentStatus: string
      paymentStage: string | null
      paidAt: Date | null
    }>
  }>,
) {
  const map = new Map<
    string,
    {
      price: number
      paymentStatus: string
      paymentStage: string | null
      paidAt: Date | null
    }
  >()

  for (const athlete of athletes) {
    const birthDate = athlete.birthDate.toISOString().slice(0, 10)
    for (const entry of athlete.entries) {
      if (!entry.ageDivisionId || !entry.weightCategoryId) continue
      map.set(
        athleteEntryPreserveKey(
          {
            lastName: athlete.lastName,
            firstName: athlete.firstName,
            middleName: athlete.middleName,
            birthDate,
          },
          {
            discipline: entry.discipline,
            experienceLevel: entry.experienceLevel as DisciplineEntryBody['experienceLevel'],
            ageDivisionId: entry.ageDivisionId,
            weightCategoryId: entry.weightCategoryId,
          },
        ),
        {
          price: entry.price,
          paymentStatus: entry.paymentStatus,
          paymentStage: entry.paymentStage,
          paidAt: entry.paidAt,
        },
      )
    }
  }

  return map
}

function priceForDisciplineEntry(
  basePricePerDiscipline: number,
  entry: DisciplineEntryBody,
  clubDiscountPercent: number | null | undefined,
  rules: CategoryDiscountRuleLike[],
): number {
  return resolveEntryPrice(
    basePricePerDiscipline,
    {
      discipline: entry.discipline,
      experienceLevel: entry.experienceLevel,
      ageDivisionId: entry.ageDivisionId,
    },
    rules,
    clubDiscountPercent,
  )
}

function buildEntryCreatePayload(
  athlete: {
    lastName: string
    firstName: string
    middleName?: string | null
    birthDate: string
    disciplineEntries: DisciplineEntryBody[]
  },
  basePricePerDiscipline: number,
  clubDiscountPercent: number | null | undefined,
  rules: CategoryDiscountRuleLike[],
  preserved: Map<
    string,
    {
      price: number
      paymentStatus: string
      paymentStage: string | null
      paidAt: Date | null
    }
  >,
) {
  return athlete.disciplineEntries.map((entry) => {
    const saved = preserved.get(athleteEntryPreserveKey(athlete, entry))
    if (saved && saved.paymentStatus !== 'UNPAID') {
      return {
        discipline: entry.discipline,
        experienceLevel: entry.experienceLevel,
        ageDivisionId: entry.ageDivisionId,
        weightCategoryId: entry.weightCategoryId,
        price: saved.price,
        paymentStatus: saved.paymentStatus as EntryPaymentStatus,
        paymentStage: saved.paymentStage,
        paidAt: saved.paidAt,
      }
    }

    return {
      discipline: entry.discipline,
      experienceLevel: entry.experienceLevel,
      ageDivisionId: entry.ageDivisionId,
      weightCategoryId: entry.weightCategoryId,
      price: priceForDisciplineEntry(basePricePerDiscipline, entry, clubDiscountPercent, rules),
      paymentStatus: 'UNPAID' as const,
      paymentStage: null,
      paidAt: null,
    }
  })
}

export async function createTeamRegistration(
  body: RegistrationCreateBody,
  userAgent?: string,
): Promise<{ id: string; publicNumber: number; editToken: string; totalAmount: number }> {
  const now = getServerNow()
  await loadRegistrationSchedule()
  assertUserRegistrationChangesAllowed()

  const stageId = getCurrentRegistrationStage(now)
  if (!stageId) throw new RegistrationClosedError()

  const { getRegistrationScheduleSync } = await import('./schedule')
  const schedule = getRegistrationScheduleSync()
  if (schedule.maxAthletes != null) {
    const current = await countActiveAthletes()
    if (current + body.athletes.length > schedule.maxAthletes) {
      throw new RegistrationLimitError(schedule.maxAthletes)
    }
  }

  const basePricePerDiscipline = schedule.stagesById[stageId]?.pricePerDiscipline ?? 0
  const discountRules = await listActiveCategoryDiscountRules()

  const phone = normalizePhoneToE164(body.phone) ?? body.phone
  const email = body.email.trim() ? normalizeEmail(body.email) : null
  const priceHeldUntil = new Date(now.getTime() + PRICE_HOLD_HOURS * 60 * 60 * 1000)
  const club = await resolveRegistrationClub({
    clubId: body.clubId,
    clubName: body.clubName,
    city: body.city,
  })
  const pricePerDiscipline = applyClubDiscount(basePricePerDiscipline, club.discountPercent)

  const athletesCreate = body.athletes.map((athlete) => ({
    ...athleteNameFields(athlete),
    birthDate: new Date(`${athlete.birthDate}T12:00:00`),
    gender: athlete.gender,
    weight: weightCategoryToDeclaredKg(athlete.disciplineEntries[0]?.weightCategoryId),
    rank: athlete.rank ?? null,
    entries: {
      create: athlete.disciplineEntries.map((entry) => ({
        discipline: entry.discipline,
        experienceLevel: entry.experienceLevel,
        ageDivisionId: entry.ageDivisionId,
        weightCategoryId: entry.weightCategoryId,
        price: priceForDisciplineEntry(
          basePricePerDiscipline,
          entry,
          club.discountPercent,
          discountRules,
        ),
        paymentStatus: 'UNPAID' as const,
      })),
    },
  }))

  const totalAmount = athletesCreate.reduce(
    (sum, athlete) => sum + athlete.entries.create.reduce((entrySum, entry) => entrySum + entry.price, 0),
    0,
  )
  const editCodeHash = await hashEditCode(body.editCode)

  const { withBracketImpactAfterCommit } = await import('./bracketImpactCoordinator')
  return withBracketImpactAfterCommit(async () => {
    const created = await prisma.teamRegistration.create({
      data: {
        clubId: club.id,
        clubName: club.name,
        city: club.city,
        phone,
        email,
        registrationStage: stageId,
        pricePerDiscipline,
        totalAmount,
        status: 'AWAITING_PAYMENT',
        priceHeldUntil,
        consentPersonalData: body.consentPersonalData,
        consentPublication: body.consentPublication,
        userAgent,
        editCodeHash,
        athletes: { create: athletesCreate },
      },
      select: { id: true, publicNumber: true, editToken: true, totalAmount: true },
    })

    await grantDeviceAccess(created.id, body.deviceToken)
    return created
  })
}

export async function getRegistrationByToken(editToken: string) {
  return prisma.teamRegistration.findUnique({
    where: { editToken },
    include: {
      athletes: { include: { entries: true }, orderBy: athleteOrderBy },
      paymentProofs: { orderBy: { uploadedAt: 'desc' } },
    },
  })
}

export async function getRegistrationById(id: string) {
  return prisma.teamRegistration.findUnique({
    where: { id },
    include: {
      club: { select: { discountPercent: true } },
      athletes: { include: { entries: true }, orderBy: athleteOrderBy },
      paymentProofs: { orderBy: { uploadedAt: 'desc' } },
    },
  })
}

export async function updateTeamRegistration(
  editToken: string,
  body: RegistrationBody,
): Promise<{ id: string; publicNumber: number; totalAmount: number }> {
  const now = getServerNow()
  await loadRegistrationSchedule()
  assertUserRegistrationChangesAllowed()

  const existing = await getRegistrationByToken(editToken)
  if (!existing || existing.status === 'CANCELLED') {
    throw new Error('NOT_FOUND')
  }

  const stageId = getCurrentRegistrationStage(now)
  if (!stageId) throw new RegistrationClosedError()

  validateRegistrationEdit(existing.athletes, body)

  const existingAthleteMap = new Map(existing.athletes.map((athlete) => [athlete.id, athlete]))

  const phone = normalizePhoneToE164(body.phone) ?? body.phone
  const email = body.email.trim() ? normalizeEmail(body.email) : null
  const club = await resolveRegistrationClub({
    clubId: body.clubId,
    clubName: body.clubName,
    city: body.city,
  })
  const clubChanged = club.id !== existing.clubId
  let registrationDataChanged = clubChanged
  const pricePerDiscipline = clubChanged
    ? getRegistrationPricePerDiscipline(existing.registrationStage, club.discountPercent)
    : existing.pricePerDiscipline
  const { getRegistrationScheduleSync } = await import('./schedule')
  const basePricePerDiscipline = getEffectiveBasePriceForUnpaidEntries(existing.registrationStage)
  const discountRules = await listActiveCategoryDiscountRules()

  const submittedAthleteIds = new Set(
    body.athletes.filter((athlete) => athlete.athleteId).map((athlete) => athlete.athleteId!),
  )

  await prisma.$transaction(async (tx) => {
    await tx.teamRegistration.update({
      where: { id: existing.id },
      data: {
        clubId: club.id,
        clubName: club.name,
        city: club.city,
        phone,
        email,
        pricePerDiscipline,
        consentPersonalData: body.consentPersonalData,
        consentPublication: body.consentPublication,
      },
    })

    for (const athlete of existing.athletes) {
      if (submittedAthleteIds.has(athlete.id)) continue
      await tx.paymentProofEntry.deleteMany({
        where: { entryId: { in: athlete.entries.map((entry) => entry.id) } },
      })
      await tx.athlete.delete({ where: { id: athlete.id } })
    }

    for (const athleteBody of body.athletes) {
      if (athleteBody.athleteId && existingAthleteMap.has(athleteBody.athleteId)) {
        const existingAthlete = existingAthleteMap.get(athleteBody.athleteId)!
        const existingEntryMap = new Map(existingAthlete.entries.map((entry) => [entry.id, entry]))
        const submittedEntryIds = new Set(
          athleteBody.disciplineEntries
            .filter((entry) => entry.entryId)
            .map((entry) => entry.entryId!),
        )

        for (const entry of existingAthlete.entries) {
          if (submittedEntryIds.has(entry.id)) continue
          if (isLockedEntryStatus(entry.paymentStatus as EntryPaymentStatus)) continue
          await tx.paymentProofEntry.deleteMany({ where: { entryId: entry.id } })
          await tx.athleteEntry.delete({ where: { id: entry.id } })
        }

        await tx.athlete.update({
          where: { id: athleteBody.athleteId },
          data: {
            ...athleteNameFields(athleteBody),
            birthDate: new Date(`${athleteBody.birthDate}T12:00:00`),
            gender: athleteBody.gender,
            rank: athleteBody.rank ?? null,
            weight: weightCategoryToDeclaredKg(athleteBody.disciplineEntries[0]?.weightCategoryId),
          },
        })

        for (const entryBody of athleteBody.disciplineEntries) {
          if (entryBody.entryId && existingEntryMap.has(entryBody.entryId)) {
            const existingEntry = existingEntryMap.get(entryBody.entryId)!
            if (existingEntry.paymentStatus === 'UNPAID') {
              const categoryChanged =
                existingEntry.discipline !== entryBody.discipline ||
                existingEntry.experienceLevel !== entryBody.experienceLevel ||
                existingEntry.ageDivisionId !== entryBody.ageDivisionId ||
                existingEntry.weightCategoryId !== entryBody.weightCategoryId
              if (categoryChanged) registrationDataChanged = true
              await tx.athleteEntry.update({
                where: { id: entryBody.entryId },
                data: {
                  discipline: entryBody.discipline,
                  experienceLevel: entryBody.experienceLevel,
                  ageDivisionId: entryBody.ageDivisionId,
                  weightCategoryId: entryBody.weightCategoryId,
                  price: priceForDisciplineEntry(
                    basePricePerDiscipline,
                    entryBody,
                    club.discountPercent,
                    discountRules,
                  ),
                },
              })
            }
            continue
          }

          registrationDataChanged = true
          await tx.athleteEntry.create({
            data: {
              athleteId: athleteBody.athleteId,
              discipline: entryBody.discipline,
              experienceLevel: entryBody.experienceLevel,
              ageDivisionId: entryBody.ageDivisionId,
              weightCategoryId: entryBody.weightCategoryId,
              price: priceForDisciplineEntry(
                basePricePerDiscipline,
                entryBody,
                club.discountPercent,
                discountRules,
              ),
              paymentStatus: 'UNPAID',
            },
          })
        }
        continue
      }

      registrationDataChanged = true
      await tx.athlete.create({
        data: {
          registrationId: existing.id,
          ...athleteNameFields(athleteBody),
          birthDate: new Date(`${athleteBody.birthDate}T12:00:00`),
          gender: athleteBody.gender,
          rank: athleteBody.rank ?? null,
          weight: weightCategoryToDeclaredKg(athleteBody.disciplineEntries[0]?.weightCategoryId),
          entries: {
            create: athleteBody.disciplineEntries.map((entry) => ({
              discipline: entry.discipline,
              experienceLevel: entry.experienceLevel,
              ageDivisionId: entry.ageDivisionId,
              weightCategoryId: entry.weightCategoryId,
              price: priceForDisciplineEntry(
                basePricePerDiscipline,
                entry,
                club.discountPercent,
                discountRules,
              ),
              paymentStatus: 'UNPAID',
            })),
          },
        },
      })
    }
  })

  if (clubChanged) {
    await recalculateUnpaidEntryPricesForRegistration(existing.id, discountRules)
  } else {
    await syncRegistrationTotals(existing.id)
  }

  if (registrationDataChanged) {
    const { stableJsonHash } = await import('../brackets/live/impactToken')
    const { collectCategoryKeysFromRegistrationBody } = await import('./bracketAutoSync')
    const { withBracketImpactAfterCommit } = await import('./bracketImpactCoordinator')
    const categoryKeys = collectCategoryKeysFromRegistrationBody(body.athletes)
    const mutationFingerprint = stableJsonHash({
      kind: 'registration_edit',
      registrationId: existing.id,
    })
    return withBracketImpactAfterCommit(
      async () => {
        const updated = await prisma.teamRegistration.findUnique({
          where: { id: existing.id },
          select: { totalAmount: true },
        })
        return {
          id: existing.id,
          publicNumber: existing.publicNumber,
          totalAmount: updated?.totalAmount ?? 0,
        }
      },
      {
        registrationId: existing.id,
        mutationFingerprint,
        categoryKeys,
      },
    )
  }

  const updated = await prisma.teamRegistration.findUnique({
    where: { id: existing.id },
    select: { totalAmount: true },
  })

  return {
    id: existing.id,
    publicNumber: existing.publicNumber,
    totalAmount: updated?.totalAmount ?? 0,
  }
}

export { RegistrationEditError }

export async function getPublicParticipantStats() {
  const registrations = await prisma.teamRegistration.findMany({
    where: { status: { in: ['PAID', 'PAYMENT_REVIEW', 'AWAITING_PAYMENT', 'SUBMITTED'] }, consentPublication: true },
    include: { athletes: { include: { entries: true } } },
  })

  let athletes = 0
  let tacticControl = 0
  let closeControl = 0
  let entries = 0
  const clubKeys = new Set<string>()

  for (const reg of registrations) {
    clubKeys.add(`${reg.clubName}\0${reg.city}`)
    for (const athlete of reg.athletes) {
      athletes += 1
      for (const entry of athlete.entries) {
        entries += 1
        if (entry.discipline === 'tactic_control') tacticControl += 1
        if (entry.discipline === 'close_control') closeControl += 1
      }
    }
  }

  return { athletes, clubs: clubKeys.size, tacticControl, closeControl, entries }
}

export async function getPublicAthleteRows(filters?: {
  discipline?: string
  gender?: string
  club?: string
  city?: string
  name?: string
  ageDivisionId?: string
  weightCategoryId?: string
  experienceLevel?: string
  paymentStatus?: string
  weightMin?: number
  weightMax?: number
  ageMin?: number
  ageMax?: number
}): Promise<PublicAthleteRow[]> {
  const mandateChecks = await prisma.athleteMandateCheck.findMany({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
  })
  const hasWeighInByAthleteId = new Map(
    mandateChecks.map((row) => [
      row.athleteId,
      hasWeighInFromCheckRecord(serializeMandateCheckRecord(row)),
    ]),
  )

  const registrations = await prisma.teamRegistration.findMany({
    where: {
      consentPublication: true,
      status: { notIn: ['CANCELLED'] },
    },
    include: { athletes: { include: { entries: true } } },
    orderBy: [{ createdAt: 'desc' }, { publicNumber: 'desc' }],
  })

  const rows: PublicAthleteRow[] = []

  for (const reg of registrations) {
    for (const athlete of reg.athletes) {
      const entryDetails = serializeAthleteEntries(athlete.entries, athlete.rank).map((entry) => ({
        ...entry,
        paymentStatus: toPublicEntryPaymentStatus(entry.paymentStatus),
        paymentStatusLabel: getPublicEntryPaymentStatusLabel(entry.paymentStatus),
        confirmed: isConfirmedForPublicList(entry.paymentStatus),
      }))
      const disciplines = [...new Set(entryDetails.map((e) => e.discipline))]

      if (filters?.discipline && !disciplines.includes(filters.discipline)) continue
      if (filters?.gender && athlete.gender !== filters.gender) continue
      if (filters?.club) {
        const clubQuery = filters.club.toLowerCase()
        const matchesClub = reg.clubName.toLowerCase().includes(clubQuery)
        const matchesCity = reg.city.toLowerCase().includes(clubQuery)
        if (!matchesClub && !matchesCity) continue
      }
      if (filters?.city && !reg.city.toLowerCase().includes(filters.city.toLowerCase())) continue
      if (
        filters?.name &&
        !participantSearchMatchesQuery(
          {
            lastName: athlete.lastName,
            firstName: athlete.firstName,
            middleName: athlete.middleName,
          },
          reg.clubName,
          filters.name,
        )
      ) {
        continue
      }
      if (
        filters?.ageDivisionId &&
        !entryDetails.some((e) => e.ageDivisionId === filters.ageDivisionId)
      ) {
        continue
      }
      if (
        filters?.weightCategoryId &&
        !entryDetails.some((e) => e.weightCategoryId === filters.weightCategoryId)
      ) {
        continue
      }
      if (
        filters?.experienceLevel &&
        !entryDetails.some((e) => e.experienceLevel === filters.experienceLevel)
      ) {
        continue
      }
      if (filters?.paymentStatus) {
        const rawEntries = serializeAthleteEntries(athlete.entries, athlete.rank)
        const matchesPaymentFilter = rawEntries.some((entry) =>
          matchesPublicPaidPaymentFilter(entry.paymentStatus, filters.paymentStatus!),
        )
        if (!matchesPaymentFilter) continue
      }

      const weight = athlete.weight ?? 0
      if (filters?.weightMin != null && weight < filters.weightMin) continue
      if (filters?.weightMax != null && weight > filters.weightMax) continue

      const ageYears = getAthleteAgeOnTournamentDate(athlete.birthDate)
      if (ageYears == null) continue
      if (filters?.ageMin != null && ageYears < filters.ageMin) continue
      if (filters?.ageMax != null && ageYears > filters.ageMax) continue

      const rawPaymentStatus = aggregateEntryPaymentStatus(
        athlete.entries.map((entry) => entry.paymentStatus as EntryPaymentStatus),
      )
      const paymentStatus = toPublicEntryPaymentStatus(rawPaymentStatus)

      rows.push({
        fullName: formatAthleteFullName({
          lastName: athlete.lastName,
          firstName: athlete.firstName,
          middleName: athlete.middleName,
        }),
        lastName: athlete.lastName,
        firstName: athlete.firstName,
        middleName: athlete.middleName,
        clubName: reg.clubName,
        city: reg.city,
        gender: athlete.gender,
        birthDate: athlete.birthDate,
        weight: athlete.weight,
        rank: athlete.rank,
        disciplines,
        entries: entryDetails,
        paymentStatus,
        status: getParticipantListStatusLabel(rawPaymentStatus),
        hasWeighIn: hasWeighInByAthleteId.get(athlete.id) ?? false,
      })
    }
  }

  return rows
}

export async function getRegistrationKpi() {
  const registrations = await prisma.teamRegistration.findMany({
    where: { status: { not: 'CANCELLED' } },
    include: { athletes: { include: { entries: true } } },
  })

  let athletes = 0
  let entries = 0
  let charged = 0
  let confirmed = 0
  let admitted = 0
  let pending = 0

  for (const reg of registrations) {
    athletes += reg.athletes.length
    for (const athlete of reg.athletes) {
      for (const entry of athlete.entries) {
        entries += 1
        charged += entry.price
        const bucket = getEntryPaymentKpiBucket(entry.paymentStatus as EntryPaymentStatus)
        if (bucket === 'confirmed') confirmed += entry.price
        else if (bucket === 'admitted') admitted += entry.price
        else pending += entry.price
      }
    }
  }

  return {
    athletes,
    entries,
    charged,
    confirmed,
    admitted,
    pending,
    registrations: registrations.length,
  }
}

export class AdminAthleteError extends Error {
  code: string

  constructor(code: string) {
    super(code)
    this.code = code
  }
}

export async function createAthleteAsAdmin(
  registrationId: string,
  body: AthleteBody,
  options?: { impactToken?: string },
) {
  const registration = await prisma.teamRegistration.findUnique({
    where: { id: registrationId },
  })
  if (!registration) throw new AdminAthleteError('NOT_FOUND')
  if (registration.status === 'CANCELLED') throw new AdminAthleteError('REGISTRATION_CANCELLED')

  await loadRegistrationSchedule()
  const { getRegistrationScheduleSync } = await import('./schedule')
  const schedule = getRegistrationScheduleSync()
  if (schedule.maxAthletes != null) {
    const current = await countActiveAthletes()
    if (current + 1 > schedule.maxAthletes) {
      throw new RegistrationLimitError(schedule.maxAthletes)
    }
  }

  const basePricePerDiscipline = getEffectiveBasePriceForUnpaidEntries(registration.registrationStage)
  const club = registration.clubId ? await getClubById(registration.clubId) : null
  const discountRules = await listActiveCategoryDiscountRules()

  const { stableJsonHash } = await import('../brackets/live/impactToken')
  const { collectCategoryKeysFromAthletes } = await import('./bracketAutoSync')
  const { withBracketImpactAfterCommit } = await import('./bracketImpactCoordinator')
  const mutationFingerprint = stableJsonHash({
    kind: 'athlete_create',
    registrationId,
    body: {
      lastName: body.lastName.trim(),
      firstName: body.firstName.trim(),
      middleName: body.middleName?.trim() || null,
      birthDate: body.birthDate,
      gender: body.gender,
      rank: body.rank ?? null,
      disciplineEntries: body.disciplineEntries.map((entry) => ({
        discipline: entry.discipline,
        ageDivisionId: entry.ageDivisionId,
        weightCategoryId: entry.weightCategoryId,
        experienceLevel: entry.experienceLevel,
      })),
    },
  })
  const categoryKeys = collectCategoryKeysFromAthletes([
    { gender: body.gender, entries: body.disciplineEntries },
  ])

  return withBracketImpactAfterCommit(async () => {
    const athlete = await prisma.athlete.create({
      data: {
        registrationId,
        ...athleteNameFields(body),
        birthDate: new Date(`${body.birthDate}T12:00:00`),
        gender: body.gender,
        rank: body.rank ?? null,
        weight: weightCategoryToDeclaredKg(body.disciplineEntries[0]?.weightCategoryId),
        entries: {
          create: body.disciplineEntries.map((entry) => ({
            discipline: entry.discipline,
            experienceLevel: entry.experienceLevel,
            ageDivisionId: entry.ageDivisionId,
            weightCategoryId: entry.weightCategoryId,
            price: priceForDisciplineEntry(
              basePricePerDiscipline,
              entry,
              club?.discountPercent,
              discountRules,
            ),
            paymentStatus: 'UNPAID',
          })),
        },
      },
    })

    await syncRegistrationTotals(registrationId)
    return { id: athlete.id }
  }, {
    registrationId,
    mutationFingerprint,
    categoryKeys,
    impactToken: options?.impactToken,
  })
}

export async function createStandaloneAthleteAsAdmin(
  body: StandaloneAthleteBody,
  options?: { impactToken?: string },
): Promise<{ athleteId: string; registrationId: string; publicNumber: number }> {
  const now = getServerNow()
  await loadRegistrationSchedule()
  const stageId = getCurrentRegistrationStage(now)
  if (!stageId) throw new RegistrationClosedError()

  const { getRegistrationScheduleSync } = await import('./schedule')
  const schedule = getRegistrationScheduleSync()
  if (schedule.maxAthletes != null) {
    const current = await countActiveAthletes()
    if (current + 1 > schedule.maxAthletes) {
      throw new RegistrationLimitError(schedule.maxAthletes)
    }
  }

  const basePricePerDiscipline = schedule.stagesById[stageId]?.pricePerDiscipline ?? 0
  const discountRules = await listActiveCategoryDiscountRules()
  const phone = normalizePhoneToE164(body.phone) ?? body.phone
  const club = await resolveRegistrationClub({
    clubName: body.clubName,
    city: body.city,
  })
  const pricePerDiscipline = applyClubDiscount(basePricePerDiscipline, club.discountPercent)
  const priceHeldUntil = new Date(now.getTime() + PRICE_HOLD_HOURS * 60 * 60 * 1000)

  const entryCreates = body.disciplineEntries.map((entry) => ({
    discipline: entry.discipline,
    experienceLevel: entry.experienceLevel,
    ageDivisionId: entry.ageDivisionId,
    weightCategoryId: entry.weightCategoryId,
    price: priceForDisciplineEntry(
      basePricePerDiscipline,
      entry,
      club.discountPercent,
      discountRules,
    ),
    paymentStatus: 'UNPAID' as const,
  }))
  const totalAmount = entryCreates.reduce((sum, entry) => sum + entry.price, 0)

  const { collectCategoryKeysFromAthletes } = await import('./bracketAutoSync')
  const { bumpRegistrationRevisionInTransaction, runPostCommitBracketSync } = await import(
    './bracketImpactCoordinator'
  )
  const { computeImpactForForceRebuild } = await import('../brackets/live/impact')
  const { requiresDestructiveConfirm } = await import('../brackets/live/commitImpact')
  const { DestructiveConfirmRequiredError } = await import('../brackets/live/errors')
  const { acquireBracketWriteLocks } = await import('../brackets/live/locks')
  const { forceRebuildCategories } = await import('../brackets/live/forceRebuild')
  const { incrementRegistrationRevision } = await import('../brackets/core/locks')
  const { verifyImpactToken, impactMatches } = await import('../brackets/live/impactToken')
  const { ImpactChangedError } = await import('../brackets/live/errors')
  const { BRACKET_MUTATION_TX_OPTIONS } = await import('../brackets/core/transactionOptions')

  const categoryKeys = collectCategoryKeysFromAthletes([
    { gender: body.gender, entries: body.disciplineEntries },
  ])

  const registrationData = {
    clubId: club.id,
    clubName: club.name,
    city: club.city,
    phone,
    registrationStage: stageId,
    pricePerDiscipline,
    totalAmount,
    status: 'AWAITING_PAYMENT' as const,
    priceHeldUntil,
    consentPersonalData: true,
    consentPublication: true,
    athletes: {
      create: {
        ...athleteNameFields(body),
        birthDate: new Date(`${body.birthDate}T12:00:00`),
        gender: body.gender,
        rank: body.rank ?? null,
        weight: weightCategoryToDeclaredKg(body.disciplineEntries[0]?.weightCategoryId),
        entries: { create: entryCreates },
      },
    },
  }

  if (options?.impactToken) {
    return prisma.$transaction(async (tx) => {
      const ctx = await acquireBracketWriteLocks(tx, { scope: 'destructive_admin' })
      const tokenPayload = verifyImpactToken(options.impactToken!)
      const actualImpact = await computeImpactForForceRebuild(tx, categoryKeys)
      if (
        !impactMatches(tokenPayload, {
          operation: 'standalone_force_rebuild',
          mutationFingerprint: actualImpact.mutationFingerprint,
          liveGenerationId: actualImpact.liveGenerationId,
          liveGenerationVersion: actualImpact.liveGenerationVersion,
          affectedCategoryKeys: actualImpact.affectedCategoryKeys,
          lockLevels: actualImpact.lockLevels,
        })
      ) {
        throw new ImpactChangedError({
          affectedCategoryKeys: actualImpact.affectedCategoryKeys,
          lockLevels: actualImpact.lockLevels,
        })
      }

      const created = await tx.teamRegistration.create({
        data: registrationData,
        select: {
          id: true,
          publicNumber: true,
          athletes: { select: { id: true }, take: 1 },
        },
      })

      await incrementRegistrationRevision(tx)

      if (actualImpact.affectedCategoryKeys.length > 0) {
        await forceRebuildCategories(tx, {
          generationId: ctx.generation.id,
          categoryKeys: actualImpact.affectedCategoryKeys,
          preserveVisible: true,
        })
      }

      await tx.bracketGeneration.update({
        where: { id: ctx.generation.id },
        data: { version: ctx.generation.version + 1 },
      })

      return {
        athleteId: created.athletes[0]!.id,
        registrationId: created.id,
        publicNumber: created.publicNumber,
      }
    }, BRACKET_MUTATION_TX_OPTIONS)
  }

  const preview = await prisma.$transaction((tx) => computeImpactForForceRebuild(tx, categoryKeys))
  if (requiresDestructiveConfirm(preview.lockLevels)) {
    throw new DestructiveConfirmRequiredError()
  }

  const created = await prisma.teamRegistration.create({
    data: registrationData,
    select: {
      id: true,
      publicNumber: true,
      athletes: { select: { id: true }, take: 1 },
    },
  })

  await bumpRegistrationRevisionInTransaction()
  await runPostCommitBracketSync(categoryKeys)

  return {
    athleteId: created.athletes[0]!.id,
    registrationId: created.id,
    publicNumber: created.publicNumber,
  }
}

export async function updateAthleteAsAdmin(
  athleteId: string,
  body: AthleteBody,
  options?: { impactToken?: string },
) {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    include: { entries: true, registration: true },
  })
  if (!athlete) throw new AdminAthleteError('NOT_FOUND')

  const registration = athlete.registration
  const basePricePerDiscipline = getEffectiveBasePriceForUnpaidEntries(registration.registrationStage)
  const club = registration.clubId ? await getClubById(registration.clubId) : null
  const discountRules = await listActiveCategoryDiscountRules()
  const preserved = buildPreservedEntryMap([athlete])

  const { stableJsonHash } = await import('../brackets/live/impactToken')
  const { collectCategoryKeysFromAthletes } = await import('./bracketAutoSync')
  const { withBracketImpactAfterCommit } = await import('./bracketImpactCoordinator')
  const mutationFingerprint = stableJsonHash({
    kind: 'athlete_update',
    athleteId,
    registrationId: athlete.registrationId,
    body: {
      lastName: body.lastName.trim(),
      firstName: body.firstName.trim(),
      middleName: body.middleName?.trim() || null,
      birthDate: body.birthDate,
      gender: body.gender,
      rank: body.rank ?? null,
      disciplineEntries: body.disciplineEntries.map((entry) => ({
        discipline: entry.discipline,
        ageDivisionId: entry.ageDivisionId,
        weightCategoryId: entry.weightCategoryId,
        experienceLevel: entry.experienceLevel,
      })),
    },
  })
  const entryIds = athlete.entries.map((entry) => entry.id)
  const categoryKeys = collectCategoryKeysFromAthletes([
    { gender: athlete.gender, entries: athlete.entries },
    { gender: body.gender, entries: body.disciplineEntries },
  ])

  await withBracketImpactAfterCommit(async (tx) => {
    const applyUpdate = async (db: Prisma.TransactionClient) => {
      await db.paymentProofEntry.deleteMany({
        where: { entryId: { in: athlete.entries.map((entry) => entry.id) } },
      })
      await db.athleteEntry.deleteMany({ where: { athleteId } })

      await db.athlete.update({
        where: { id: athleteId },
        data: {
          ...athleteNameFields(body),
          birthDate: new Date(`${body.birthDate}T12:00:00`),
          gender: body.gender,
          rank: body.rank ?? null,
          weight: weightCategoryToDeclaredKg(body.disciplineEntries[0]?.weightCategoryId),
          entries: {
            create: buildEntryCreatePayload(
              {
                lastName: body.lastName,
                firstName: body.firstName,
                middleName: body.middleName,
                birthDate: body.birthDate,
                disciplineEntries: body.disciplineEntries,
              },
              basePricePerDiscipline,
              club?.discountPercent,
              discountRules,
              preserved,
            ),
          },
        },
      })
    }

    if (tx) {
      await applyUpdate(tx)
      return
    }

    await prisma.$transaction(applyUpdate)
  }, {
    registrationId: athlete.registrationId,
    mutationFingerprint,
    categoryKeys,
    entryIds,
    impactToken: options?.impactToken,
  })

  await syncRegistrationTotals(athlete.registrationId)
}

export async function deleteAthleteAsAdmin(
  athleteId: string,
  options?: { impactToken?: string },
) {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    include: {
      entries: true,
      registration: { include: { athletes: true } },
    },
  })
  if (!athlete) throw new AdminAthleteError('NOT_FOUND')
  if (athlete.registration.athletes.length <= 1) {
    throw new AdminAthleteError('LAST_ATHLETE')
  }

  const { stableJsonHash } = await import('../brackets/live/impactToken')
  const { loadCategoryKeysForEntryIds } = await import('../brackets/live/impact')
  const { withBracketImpactAfterCommit } = await import('./bracketImpactCoordinator')
  const entryIds = athlete.entries.map((entry) => entry.id)
  const mutationFingerprint = stableJsonHash({
    kind: 'athlete_delete',
    athleteId,
    registrationId: athlete.registrationId,
  })
  const categoryKeys = await prisma.$transaction((tx) => loadCategoryKeysForEntryIds(tx, entryIds))

  await withBracketImpactAfterCommit(async (tx) => {
    const applyDelete = async (db: Prisma.TransactionClient) => {
      await db.paymentProofEntry.deleteMany({
        where: { entryId: { in: athlete.entries.map((entry) => entry.id) } },
      })
      await db.athlete.delete({ where: { id: athleteId } })
    }

    if (tx) {
      await applyDelete(tx)
      return
    }

    await prisma.$transaction(applyDelete)
  }, {
    registrationId: athlete.registrationId,
    mutationFingerprint,
    categoryKeys,
    entryIds,
    impactToken: options?.impactToken,
  })

  await syncRegistrationTotals(athlete.registrationId)
}
