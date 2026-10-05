import type { AthleteMandateCheck } from '@prisma/client'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import type { ExperienceLevelId } from '@/lib/config/experienceLevel'
import { prisma } from '@/lib/prisma'
import {
  getActivePublishedGeneration,
  getCurrentPublishedDraws,
} from '@/lib/brackets/generation/publishedDraws'
import { formatAthleteFullName } from '@/lib/registration/athleteName'
import {
  getRegistrationCategoryIdentity,
  getRegistrationCategoryKey,
} from '@/lib/registration/categoryIdentity'
import { getTournamentCategoryLabel } from '@/lib/registration/categoryRules'
import {
  getEntryPaymentStatusLabel,
  type EntryPaymentStatus,
} from '@/lib/registration/status'
import { computeWeightStatus } from './computeWeightStatus'
import { computeCategoryFingerprint } from './categoryFingerprint'
import { serializeMandateCheckRecord } from './patchMandateCheck'
import type {
  MandateBracketEntry,
  MandateCommissionKpi,
  MandateCommissionListFilters,
  MandateCommissionRow,
  MandateCheckRecord,
} from './types'

function matchesSearch(
  athlete: { lastName: string; firstName: string; middleName: string | null },
  clubName: string,
  city: string,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    athlete.lastName,
    athlete.firstName,
    athlete.middleName ?? '',
    clubName,
    city,
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

function computeAggregateStatus(input: {
  check: MandateCheckRecord | null
  weightStatus: ReturnType<typeof computeWeightStatus>
  bracketEntries: MandateBracketEntry[]
}): { aggregateStatus: MandateCommissionRow['aggregateStatus']; issueCount: number } {
  let issueCount = 0
  let hasAnyCheck = false

  if (input.check) {
    hasAnyCheck = true
    if (input.check.documentsStatus === 'ISSUE') issueCount += 1
    if (input.check.documentsStatus === 'UNCHECKED') issueCount += 1
    if (input.check.medicalStatus === 'ISSUE') issueCount += 1
    if (input.check.medicalStatus === 'UNCHECKED') issueCount += 1
    if (input.check.insuranceStatus === 'ISSUE') issueCount += 1
    if (input.check.insuranceStatus === 'UNCHECKED') issueCount += 1
  } else {
    issueCount += 3
  }

  if (!input.weightStatus.hasWeighIn) {
    issueCount += 1
  } else if (input.weightStatus.manualStale) {
    issueCount += 1
  } else if (!input.weightStatus.weightEligible) {
    issueCount += 1
  }

  for (const entry of input.bracketEntries) {
    if (entry.paymentStatus === 'DEBT' || entry.paymentStatus === 'UNPAID') {
      issueCount += 1
    }
  }

  if (!hasAnyCheck && !input.weightStatus.hasWeighIn) {
    return { aggregateStatus: 'not_checked', issueCount }
  }
  if (issueCount > 0) {
    return { aggregateStatus: 'has_issues', issueCount }
  }
  return { aggregateStatus: 'all_ok', issueCount: 0 }
}

function toMandateCheckRecord(row: AthleteMandateCheck): MandateCheckRecord {
  return serializeMandateCheckRecord(row) as MandateCheckRecord
}

export async function loadPublishedBracketEntryIds(): Promise<{
  entryIds: Set<string>
  entryCategoryKey: Map<string, string>
}> {
  const activeGeneration = await getActivePublishedGeneration()
  if (!activeGeneration) {
    return { entryIds: new Set(), entryCategoryKey: new Map() }
  }

  const pairs = await getCurrentPublishedDraws({ activeGeneration, require: 'visible' })
  const entryIds = new Set<string>()
  const entryCategoryKey = new Map<string, string>()

  for (const pair of pairs) {
    for (const participant of pair.draw.participants) {
      entryIds.add(participant.entryId)
      entryCategoryKey.set(participant.entryId, pair.draw.categoryKey)
    }
  }

  return { entryIds, entryCategoryKey }
}

export async function isAthleteEligibleForMandateCommission(athleteId: string): Promise<boolean> {
  const { entryIds } = await loadPublishedBracketEntryIds()
  if (entryIds.size === 0) return false

  const match = await prisma.athleteEntry.findFirst({
    where: {
      athleteId,
      id: { in: [...entryIds] },
    },
    select: { id: true },
  })
  return match != null
}

export async function getAthleteBracketCategoryKeys(athleteId: string): Promise<string[]> {
  const { entryIds, entryCategoryKey } = await loadPublishedBracketEntryIds()
  const entries = await prisma.athleteEntry.findMany({
    where: {
      athleteId,
      id: { in: [...entryIds] },
    },
    select: { id: true },
  })
  return entries
    .map((entry) => entryCategoryKey.get(entry.id))
    .filter((key): key is string => Boolean(key))
}

export async function listMandateCommissionAthletes(
  filters: MandateCommissionListFilters = {},
): Promise<{ rows: MandateCommissionRow[]; kpi: MandateCommissionKpi }> {
  const { entryIds, entryCategoryKey } = await loadPublishedBracketEntryIds()
  if (entryIds.size === 0) {
    return {
      rows: [],
      kpi: { total: 0, allOk: 0, hasIssues: 0, notChecked: 0, notWeighedIn: 0 },
    }
  }

  const entries = await prisma.athleteEntry.findMany({
    where: { id: { in: [...entryIds] } },
    include: {
      athlete: {
        include: {
          registration: {
            select: { clubName: true, city: true, status: true },
          },
          mandateChecks: {
            where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
            take: 1,
          },
        },
      },
    },
  })

  const athleteMap = new Map<
    string,
    {
      athlete: (typeof entries)[number]['athlete']
      bracketEntries: MandateBracketEntry[]
      categoryKeys: string[]
    }
  >()

  for (const entry of entries) {
    const categoryKey = entryCategoryKey.get(entry.id)
    if (!categoryKey) continue

    const athlete = entry.athlete
    const identity = getRegistrationCategoryIdentity(entry, athlete)
    const categoryLabel =
      identity != null
        ? getTournamentCategoryLabel(
            identity.ageDivisionId,
            identity.weightCategoryId,
            entry.experienceLevel as ExperienceLevelId,
          )
        : categoryKey

    const paymentStatus = entry.paymentStatus as EntryPaymentStatus
    const bracketEntry: MandateBracketEntry = {
      entryId: entry.id,
      categoryKey,
      categoryLabel,
      paymentStatus,
      paymentStatusLabel: getEntryPaymentStatusLabel(paymentStatus),
    }

    const existing = athleteMap.get(athlete.id)
    if (existing) {
      existing.bracketEntries.push(bracketEntry)
      existing.categoryKeys.push(categoryKey)
    } else {
      athleteMap.set(athlete.id, {
        athlete,
        bracketEntries: [bracketEntry],
        categoryKeys: [categoryKey],
      })
    }
  }

  const rows: MandateCommissionRow[] = []

  for (const [athleteId, group] of athleteMap) {
    if (filters.athleteId && athleteId !== filters.athleteId) continue

    const { athlete, bracketEntries, categoryKeys } = group
    const clubName = athlete.registration.clubName
    const city = athlete.registration.city

    if (filters.q && !matchesSearch(athlete, clubName, city, filters.q)) continue
    if (filters.club) {
      const clubQuery = filters.club.trim().toLowerCase()
      const matchesClub =
        clubName.toLowerCase().includes(clubQuery) || city.toLowerCase().includes(clubQuery)
      if (!matchesClub) continue
    }
    if (filters.categoryKey && !categoryKeys.includes(filters.categoryKey)) continue

    const uniqueCategoryKeys = [...new Set(categoryKeys)]
    const mandateRow = athlete.mandateChecks[0] ?? null
    const check = mandateRow ? toMandateCheckRecord(mandateRow) : null
    const weightStatus = computeWeightStatus({ check, categoryKeys: uniqueCategoryKeys })
    const { aggregateStatus, issueCount } = computeAggregateStatus({
      check,
      weightStatus,
      bracketEntries,
    })

    if (filters.checkStatus && aggregateStatus !== filters.checkStatus) continue
    if (filters.issuesOnly && aggregateStatus !== 'has_issues') continue

    rows.push({
      athleteId,
      lastName: athlete.lastName,
      firstName: athlete.firstName,
      middleName: athlete.middleName,
      fullName: formatAthleteFullName(athlete),
      clubName,
      city,
      bracketEntries: bracketEntries.sort((a, b) =>
        a.categoryLabel.localeCompare(b.categoryLabel, 'ru'),
      ),
      check,
      weightStatus,
      aggregateStatus,
      issueCount,
    })
  }

  rows.sort((a, b) =>
    a.lastName.localeCompare(b.lastName, 'ru') ||
    a.firstName.localeCompare(b.firstName, 'ru'),
  )

  const kpi: MandateCommissionKpi = {
    total: rows.length,
    allOk: rows.filter((row) => row.aggregateStatus === 'all_ok').length,
    hasIssues: rows.filter((row) => row.aggregateStatus === 'has_issues').length,
    notChecked: rows.filter((row) => row.aggregateStatus === 'not_checked').length,
    notWeighedIn: rows.filter((row) => !row.weightStatus.hasWeighIn).length,
  }

  return { rows, kpi }
}

export async function loadMandateChecksByAthleteIds(
  athleteIds: string[],
): Promise<Map<string, MandateCheckRecord>> {
  if (athleteIds.length === 0) return new Map()

  const rows = await prisma.athleteMandateCheck.findMany({
    where: {
      tournamentScopeId: TOURNAMENT_SCOPE_ID,
      athleteId: { in: athleteIds },
    },
  })

  return new Map(rows.map((row) => [row.athleteId, toMandateCheckRecord(row)]))
}

export async function computeServerCategoryFingerprintForAthlete(
  athleteId: string,
): Promise<string> {
  const keys = await getAthleteBracketCategoryKeys(athleteId)
  return computeCategoryFingerprint(keys)
}

export type MandateCommissionPatchResult = {
  check: MandateCheckRecord
  weightStatus: ReturnType<typeof computeWeightStatus>
  aggregateStatus: MandateCommissionRow['aggregateStatus']
  issueCount: number
}

export async function patchMandateCommissionAthlete(input: {
  athleteId: string
  patch: import('./types').MandatePatchInput
}): Promise<MandateCommissionPatchResult> {
  const eligible = await isAthleteEligibleForMandateCommission(input.athleteId)
  if (!eligible) {
    throw new Error('ATHLETE_NOT_ELIGIBLE')
  }

  const categoryKeys = await getAthleteBracketCategoryKeys(input.athleteId)
  const serverCategoryFingerprint = computeCategoryFingerprint(categoryKeys)

  const existing = await prisma.athleteMandateCheck.findUnique({
    where: {
      tournamentScopeId_athleteId: {
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        athleteId: input.athleteId,
      },
    },
  })

  const { buildMandatePatchData } = await import('./patchMandateCheck')
  const data = buildMandatePatchData({
    patch: input.patch,
    existing: existing ?? undefined,
    serverCategoryFingerprint,
  })

  if (Object.keys(data).length === 0) {
    throw new Error('EMPTY_PATCH')
  }

  const saved = await prisma.athleteMandateCheck.upsert({
    where: {
      tournamentScopeId_athleteId: {
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        athleteId: input.athleteId,
      },
    },
    create: {
      tournamentScopeId: TOURNAMENT_SCOPE_ID,
      athleteId: input.athleteId,
      ...data,
    },
    update: data,
  })

  const check = toMandateCheckRecord(saved)
  const weightStatus = computeWeightStatus({ check, categoryKeys })

  const { entryIds, entryCategoryKey } = await loadPublishedBracketEntryIds()
  const athleteRecord = await prisma.athlete.findUnique({
    where: { id: input.athleteId },
    include: {
      entries: {
        where: { id: { in: [...entryIds] } },
      },
    },
  })

  const bracketEntries: MandateBracketEntry[] =
    athleteRecord?.entries.map((entry) => {
      const categoryKey = entryCategoryKey.get(entry.id) ?? ''
      const identity = getRegistrationCategoryIdentity(entry, athleteRecord)
      const paymentStatus = entry.paymentStatus as EntryPaymentStatus
      return {
        entryId: entry.id,
        categoryKey,
        categoryLabel:
          identity != null
            ? getTournamentCategoryLabel(
                identity.ageDivisionId,
                identity.weightCategoryId,
                entry.experienceLevel as ExperienceLevelId,
              )
            : categoryKey,
        paymentStatus,
        paymentStatusLabel: getEntryPaymentStatusLabel(paymentStatus),
      }
    }) ?? []

  const { aggregateStatus, issueCount } = computeAggregateStatus({
    check,
    weightStatus,
    bracketEntries,
  })

  return { check, weightStatus, aggregateStatus, issueCount }
}
