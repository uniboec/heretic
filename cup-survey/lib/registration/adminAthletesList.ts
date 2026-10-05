import type {
  EntryPaymentStatus as PrismaEntryPaymentStatus,
  Prisma,
  RegistrationStatus as PrismaRegistrationStatus,
} from '@prisma/client'
import type { ExperienceLevelId } from '@/lib/config/experienceLevel'
import { prisma } from '@/lib/prisma'
import { getTournamentCategoryLabel } from '@/lib/registration/categoryRules'
import { listActiveCategoryDiscountRules } from '@/lib/registration/categoryDiscounts'
import { getEntryGraceSummary } from '@/lib/registration/manualPayment'
import { getRegistrationScheduleSync } from '@/lib/registration/schedule'
import { getEntryPaymentStatusLabel, type EntryPaymentStatus } from '@/lib/registration/status'

export interface AdminAthleteListRow {
  id: string
  lastName: string
  firstName: string
  middleName: string | null
  birthDate: string
  gender: string
  rank: string | null
  entryCount: number
  entries: Array<{
    id: string
    discipline: string
    ageDivisionId: string | null
    weightCategoryId: string | null
    experienceLevel: string
    price: number
    paymentStatus: string
    paymentStatusLabel: string
    categoryLabel: string
    paymentProofId: string | null
    paymentProofStatus: string | null
    paymentStage: string | null
    paidAt: string | null
    graceEligibleStageId?: string | null
    graceEligibleStageLabel?: string | null
    gracePrice?: number | null
  }>
  registration: {
    id: string
    publicNumber: number
    clubName: string
    city: string
    status: string
    pricePerDiscipline: number
    registrationStage: string
    athletesCount: number
    hasEditCode: boolean
  }
}

export type AdminAthleteListFilters = {
  q?: string
  gender?: string
  discipline?: string
  paymentStatus?: string
  registrationStatus?: string
  experienceLevel?: string
}

function formatEntryLabel(entry: {
  discipline: string
  ageDivisionId: string | null
  weightCategoryId: string | null
  experienceLevel: string
}): string {
  if (entry.ageDivisionId && entry.weightCategoryId) {
    return getTournamentCategoryLabel(
      entry.ageDivisionId,
      entry.weightCategoryId,
      entry.experienceLevel as ExperienceLevelId,
    )
  }
  return `${entry.discipline} · категория не указана`
}

export function buildAthletesWhere(filters: AdminAthleteListFilters = {}): Prisma.AthleteWhereInput | undefined {
  const query = filters.q?.trim()
  const and: Prisma.AthleteWhereInput[] = []

  if (query) {
    and.push({
      OR: [
        { lastName: { contains: query, mode: 'insensitive' } },
        { firstName: { contains: query, mode: 'insensitive' } },
        { middleName: { contains: query, mode: 'insensitive' } },
        { registration: { clubName: { contains: query, mode: 'insensitive' } } },
        { registration: { city: { contains: query, mode: 'insensitive' } } },
      ],
    })
  }

  if (filters.gender) and.push({ gender: filters.gender })
  if (filters.registrationStatus) {
    and.push({ registration: { status: filters.registrationStatus as PrismaRegistrationStatus } })
  }
  if (filters.discipline) and.push({ entries: { some: { discipline: filters.discipline } } })
  if (filters.paymentStatus) {
    and.push({
      entries: { some: { paymentStatus: filters.paymentStatus as PrismaEntryPaymentStatus } },
    })
  }
  if (filters.experienceLevel) {
    and.push({ entries: { some: { experienceLevel: filters.experienceLevel } } })
  }

  if (and.length === 0) return undefined
  return { AND: and }
}

export function buildAthletesWhereFromSearchParams(
  searchParams: URLSearchParams,
): Prisma.AthleteWhereInput | undefined {
  return buildAthletesWhere({
    q: searchParams.get('q') ?? undefined,
    gender: searchParams.get('gender') ?? undefined,
    discipline: searchParams.get('discipline') ?? undefined,
    paymentStatus: searchParams.get('paymentStatus') ?? undefined,
    registrationStatus: searchParams.get('registrationStatus') ?? undefined,
    experienceLevel: searchParams.get('experienceLevel') ?? undefined,
  })
}

export async function listAdminAthletes(
  filters: AdminAthleteListFilters = {},
): Promise<AdminAthleteListRow[]> {
  const discountRules = await listActiveCategoryDiscountRules()

  const athletes = await prisma.athlete.findMany({
    where: buildAthletesWhere(filters),
    orderBy: [
      { registration: { createdAt: 'desc' } },
      { lastName: 'asc' },
      { firstName: 'asc' },
    ],
    include: {
      registration: {
        select: {
          id: true,
          publicNumber: true,
          clubName: true,
          city: true,
          status: true,
          pricePerDiscipline: true,
          registrationStage: true,
          club: { select: { discountPercent: true } },
          athletes: { select: { id: true } },
          editCodeHash: true,
        },
      },
      entries: {
        include: {
          paymentProofLinks: {
            include: {
              paymentProof: {
                select: { id: true, status: true },
              },
            },
          },
        },
      },
    },
  })

  return athletes.map((athlete) => ({
    id: athlete.id,
    lastName: athlete.lastName,
    firstName: athlete.firstName,
    middleName: athlete.middleName,
    birthDate: athlete.birthDate.toISOString().slice(0, 10),
    gender: athlete.gender,
    rank: athlete.rank,
    entryCount: athlete.entries.length,
    entries: athlete.entries.map((entry) => {
      const entryStatus = entry.paymentStatus as EntryPaymentStatus
      const proofLink =
        entry.paymentProofLinks.find((link) => link.paymentProof.status === 'pending') ??
        (entryStatus === 'PAID'
          ? entry.paymentProofLinks.find((link) => link.paymentProof.status === 'approved')
          : null)
      const grace = getEntryGraceSummary(
        {
          discipline: entry.discipline,
          experienceLevel: entry.experienceLevel,
          ageDivisionId: entry.ageDivisionId,
          paymentStatus: entry.paymentStatus as EntryPaymentStatus,
        },
        athlete.registration.registrationStage,
        athlete.registration.club?.discountPercent,
        discountRules,
      )
      return {
        id: entry.id,
        discipline: entry.discipline,
        ageDivisionId: entry.ageDivisionId,
        weightCategoryId: entry.weightCategoryId,
        experienceLevel: entry.experienceLevel,
        price: entry.price,
        paymentStatus: entry.paymentStatus,
        paymentStatusLabel:
          entryStatus === 'DEBT' && entry.paymentStage
            ? `Долг · ${getRegistrationScheduleSync().stagesById[entry.paymentStage]?.label ?? entry.paymentStage}`
            : getEntryPaymentStatusLabel(entryStatus),
        categoryLabel: formatEntryLabel(entry),
        paymentProofId: proofLink?.paymentProof.id ?? null,
        paymentProofStatus: proofLink?.paymentProof.status ?? null,
        paymentStage: entry.paymentStage,
        paidAt: entry.paidAt?.toISOString() ?? null,
        ...grace,
      }
    }),
    registration: {
      id: athlete.registration.id,
      publicNumber: athlete.registration.publicNumber,
      clubName: athlete.registration.clubName,
      city: athlete.registration.city,
      status: athlete.registration.status,
      pricePerDiscipline: athlete.registration.pricePerDiscipline,
      registrationStage: athlete.registration.registrationStage,
      athletesCount: athlete.registration.athletes.length,
      hasEditCode: Boolean(athlete.registration.editCodeHash),
    },
  }))
}
