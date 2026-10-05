import { getStageFromSchedule } from './schedule'
import { presetClubs } from '../config/presetClubs'
import { prisma } from '../prisma'
import { recalculateUnpaidEntryPricesForRegistration } from './categoryDiscounts'
import { applyClubDiscount } from './pricing'

export function normalizeClubField(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export interface ClubRecord {
  id: string
  name: string
  city: string
  discountPercent: number | null
}

const clubSelect = {
  id: true,
  name: true,
  city: true,
  discountPercent: true,
} as const

let presetSeedPromise: Promise<void> | null = null

export async function seedPresetClubs(): Promise<{ created: number; total: number }> {
  let created = 0
  for (const club of presetClubs) {
    const exists = await prisma.club.count({
      where: {
        name: { equals: club.name, mode: 'insensitive' },
        city: { equals: club.city, mode: 'insensitive' },
      },
    })
    await findOrCreateClub(club.name, club.city)
    if (exists === 0) created += 1
  }
  return { created, total: presetClubs.length }
}

async function ensurePresetClubsSeeded(): Promise<void> {
  if (!presetSeedPromise) {
    presetSeedPromise = (async () => {
      const count = await prisma.club.count()
      if (count === 0) await seedPresetClubs()
    })().catch((error) => {
      presetSeedPromise = null
      throw error
    })
  }
  await presetSeedPromise
}

export async function listClubs(search?: string): Promise<ClubRecord[]> {
  await ensurePresetClubsSeeded()
  const query = search?.trim()
  return prisma.club.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: [{ city: 'asc' }, { name: 'asc' }],
    take: 200,
    select: clubSelect,
  })
}

export async function getClubById(id: string): Promise<ClubRecord | null> {
  return prisma.club.findUnique({
    where: { id },
    select: clubSelect,
  })
}

export async function findOrCreateClub(name: string, city: string): Promise<ClubRecord> {
  const normalizedName = normalizeClubField(name)
  const normalizedCity = normalizeClubField(city)

  const existing = await prisma.club.findFirst({
    where: {
      name: { equals: normalizedName, mode: 'insensitive' },
      city: { equals: normalizedCity, mode: 'insensitive' },
    },
    select: clubSelect,
  })

  if (existing) return existing

  try {
    return await prisma.club.create({
      data: { name: normalizedName, city: normalizedCity },
      select: clubSelect,
    })
  } catch {
    const fallback = await prisma.club.findFirst({
      where: {
        name: { equals: normalizedName, mode: 'insensitive' },
        city: { equals: normalizedCity, mode: 'insensitive' },
      },
      select: clubSelect,
    })
    if (!fallback) throw new Error('CLUB_CREATE_FAILED')
    return fallback
  }
}

export class AdminClubError extends Error {
  constructor(public code: 'NOT_FOUND' | 'DUPLICATE' | 'INVALID') {
    super(code)
  }
}

export interface AdminClubListRow extends ClubRecord {
  registrationsCount: number
  athletesCount: number
  entriesCount: number
}

export function getRegistrationPricePerDiscipline(
  registrationStage: string,
  discountPercent: number | null | undefined,
): number {
  const stage = getStageFromSchedule(registrationStage)
  const basePrice = stage?.pricePerDiscipline ?? 0
  return applyClubDiscount(basePrice, discountPercent)
}

async function applyClubDiscountToRegistrations(
  clubId: string,
  discountPercent: number | null,
): Promise<void> {
  const registrations = await prisma.teamRegistration.findMany({
    where: { clubId, status: { not: 'CANCELLED' } },
    select: { id: true, registrationStage: true },
  })

  for (const registration of registrations) {
    const pricePerDiscipline = getRegistrationPricePerDiscipline(
      registration.registrationStage,
      discountPercent,
    )

    await prisma.teamRegistration.update({
      where: { id: registration.id },
      data: { pricePerDiscipline },
    })

    await recalculateUnpaidEntryPricesForRegistration(registration.id)
  }
}

export async function listClubsAsAdmin(search?: string): Promise<AdminClubListRow[]> {
  await ensurePresetClubsSeeded()
  const query = search?.trim()
  const clubs = await prisma.club.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: [{ city: 'asc' }, { name: 'asc' }],
    take: 500,
    select: {
      ...clubSelect,
      _count: { select: { registrations: true } },
    },
  })

  const clubIds = clubs.map((club) => club.id)
  const participationByClubId = new Map<string, { athletesCount: number; entriesCount: number }>()

  if (clubIds.length > 0) {
    const registrations = await prisma.teamRegistration.findMany({
      where: {
        clubId: { in: clubIds },
        status: { not: 'CANCELLED' },
      },
      select: {
        clubId: true,
        athletes: {
          select: {
            _count: { select: { entries: true } },
          },
        },
      },
    })

    for (const registration of registrations) {
      if (!registration.clubId) continue

      const current = participationByClubId.get(registration.clubId) ?? {
        athletesCount: 0,
        entriesCount: 0,
      }
      current.athletesCount += registration.athletes.length
      current.entriesCount += registration.athletes.reduce(
        (sum, athlete) => sum + athlete._count.entries,
        0,
      )
      participationByClubId.set(registration.clubId, current)
    }
  }

  return clubs.map((club) => {
    const participation = participationByClubId.get(club.id)
    return {
      id: club.id,
      name: club.name,
      city: club.city,
      discountPercent: club.discountPercent,
      registrationsCount: club._count.registrations,
      athletesCount: participation?.athletesCount ?? 0,
      entriesCount: participation?.entriesCount ?? 0,
    }
  })
}

export async function updateClubAsAdmin(
  id: string,
  input: { name: string; city: string; discountPercent?: number | null },
): Promise<ClubRecord> {
  const normalizedName = normalizeClubField(input.name)
  const normalizedCity = normalizeClubField(input.city)

  if (normalizedName.length < 2 || normalizedCity.length < 2) {
    throw new AdminClubError('INVALID')
  }

  const discountPercent =
    input.discountPercent == null || input.discountPercent === 0
      ? null
      : Math.min(100, Math.max(0, Math.round(input.discountPercent)))

  const existing = await getClubById(id)
  if (!existing) throw new AdminClubError('NOT_FOUND')

  const duplicate = await prisma.club.findFirst({
    where: {
      id: { not: id },
      name: { equals: normalizedName, mode: 'insensitive' },
      city: { equals: normalizedCity, mode: 'insensitive' },
    },
    select: { id: true },
  })
  if (duplicate) throw new AdminClubError('DUPLICATE')

  const discountChanged = discountPercent !== existing.discountPercent
  const identityChanged =
    normalizedName !== existing.name || normalizedCity !== existing.city

  const club = await prisma.$transaction(async (tx) => {
    const updated = await tx.club.update({
      where: { id },
      data: {
        name: normalizedName,
        city: normalizedCity,
        discountPercent,
      },
      select: clubSelect,
    })

    await tx.teamRegistration.updateMany({
      where: { clubId: id },
      data: { clubName: normalizedName, city: normalizedCity },
    })

    return updated
  })

  if (discountChanged) {
    await applyClubDiscountToRegistrations(id, discountPercent)
  }

  if (identityChanged) {
    const { bumpRegistrationRevision } = await import('./revision')
    await bumpRegistrationRevision()
  }

  return club
}

export async function resolveRegistrationClub(input: {
  clubId?: string
  clubName?: string
  city?: string
}): Promise<ClubRecord> {
  if (input.clubId) {
    const club = await getClubById(input.clubId)
    if (!club) throw new Error('CLUB_NOT_FOUND')
    return club
  }

  if (!input.clubName || !input.city) {
    throw new Error('CLUB_REQUIRED')
  }

  return findOrCreateClub(input.clubName, input.city)
}
