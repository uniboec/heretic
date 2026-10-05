import type { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { getRegistrationCategoryIdentity, getRegistrationCategoryKey } from '../../registration/categoryIdentity'
import { formatAthleteFullName } from '../../registration/athleteName'
import { getDisciplineShortLabel } from '../../config/tournament'
import { resolveCityKey, resolveClubKey } from './seeding/affiliationKeys'
import { getStrengthTier } from './seeding/strengthTier'
import { isEntryEligibleForParticipation } from '../../registration/status'
import type { EntryPaymentStatus } from '../../registration/status'
import type { EligibleEntry } from './types'

export interface BracketEligibilitySettings {
  includePaid: boolean
  includeUnpaid: boolean
}

function isEntryEligible(paymentStatus: string, settings: BracketEligibilitySettings): boolean {
  const status = paymentStatus as EntryPaymentStatus
  if (status === 'PAYMENT_REVIEW' || isEntryEligibleForParticipation(status)) {
    return settings.includePaid
  }
  return settings.includeUnpaid
}

export interface LoadEligibleEntriesOptions {
  /** Игнорировать ручные переносы — использовать только категории из заявок. */
  useSourceCategoryOnly?: boolean
  /** Читать placements в той же транзакции (apply/sync внутри $transaction). */
  tx?: Prisma.TransactionClient
}

function normalizeAthleteGender(gender: string | null | undefined): 'male' | 'female' {
  const value = gender?.toLowerCase()
  if (value === 'female' || value === 'f') return 'female'
  return 'male'
}

export async function loadEligibleEntries(
  settings: BracketEligibilitySettings,
  options?: LoadEligibleEntriesOptions,
): Promise<EligibleEntry[]> {
  const db = options?.tx ?? prisma
  const registrations = await db.teamRegistration.findMany({
    where: { status: { not: 'CANCELLED' } },
    include: {
      club: true,
      athletes: { include: { entries: true } },
    },
  })

  const placements = options?.useSourceCategoryOnly
    ? []
    : await db.bracketEntryPlacement.findMany()
  const placementMap = new Map(placements.map((p) => [p.entryId, p.categoryKey]))

  const result: EligibleEntry[] = []

  for (const reg of registrations) {
    const clubName = reg.club?.name ?? reg.clubName
    const city = reg.club?.city ?? reg.city
    const clubIdentity = `${clubName}::${city}`

    for (const athlete of reg.athletes) {
      for (const entry of athlete.entries) {
        if (!isEntryEligible(entry.paymentStatus, settings)) continue
        const identity = getRegistrationCategoryIdentity(entry, athlete)
        if (!identity) continue
        const sourceCategoryKey = getRegistrationCategoryKey(identity)
        const effectiveCategoryKey = placementMap.get(entry.id) ?? sourceCategoryKey

        result.push({
          entryId: entry.id,
          sourceCategoryKey,
          effectiveCategoryKey,
          clubIdentity,
          displayName: formatAthleteFullName(athlete),
          clubName,
          city,
          clubId: reg.clubId,
          rankId: athlete.rank,
          gender: normalizeAthleteGender(athlete.gender),
          strengthTier: getStrengthTier(athlete.rank),
          clubKey: resolveClubKey(reg.clubId, clubName, city),
          cityKey: resolveCityKey(city),
          publicNumber: reg.publicNumber,
          paymentStatus: entry.paymentStatus,
        })
      }
    }
  }

  return result
}

export function buildCategoryTitle(discipline: string, categoryLabel: string): string {
  return `${getDisciplineShortLabel(discipline)} · ${categoryLabel}`
}

export async function resolveCategoryLabel(categoryKey: string): Promise<{ discipline: string; title: string } | null> {
  const [discipline] = categoryKey.split(':')
  const entries = await loadEligibleEntries({ includePaid: true, includeUnpaid: true })
  const match = entries.find((e) => e.effectiveCategoryKey === categoryKey || e.sourceCategoryKey === categoryKey)
  if (!match) {
    return { discipline, title: categoryKey }
  }
  return { discipline, title: categoryKey }
}
