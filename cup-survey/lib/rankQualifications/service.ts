import { getDisciplineShortLabel, TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import type { SportRankId } from '@/lib/config/ranks'
import { isEventFinalized } from '@/lib/bouts/eventFinalized'
import { getCategoryLabelFromKey } from '@/lib/registration/categoryIdentity'
import { formatAthleteFullName } from '@/lib/registration/athleteName'
import { prisma } from '@/lib/prisma'
import { formatNormRankLabel, NORM_QUALIFICATIONS_DISCLAIMER } from './formatResultLabel'
import { maybeRecalculateOnEventFinalized } from './recalculate'
import { sortNormQualificationRows } from './sortAndFilter'
import { getNormQualificationSettings, hasNormQualificationData } from './settings'
import type {
  NormQualificationsPublicRow,
  NormQualificationsResponse,
} from './types'

type ScopeNormData = {
  calculatedAt: Date | null
  results: Array<{
    athleteId: string
    discipline: string
    achievedNormRank: string | null
    displayPlacement: number | null
    displayWins: number | null
  }>
  bracketDetails: Array<{
    athleteId: string
    discipline: string
    categoryKey: string
    achievedRank: string | null
    placement: number | null
    wins: number
  }>
}

function pickSourceBracketKey(
  row: {
    placement: number | null
    wins: number | null
    matchingBrackets: Array<{ categoryKey: string; placement: number; wins: number }>
  },
): string | null {
  const source =
    row.matchingBrackets.find(
      (bracket) => bracket.placement === row.placement && bracket.wins === row.wins,
    ) ?? row.matchingBrackets[0]
  return source?.categoryKey ?? null
}

export async function buildNormQualificationPublicRows(
  data: ScopeNormData,
): Promise<NormQualificationsPublicRow[]> {
  const athletes = await prisma.athlete.findMany({
    where: { id: { in: data.results.map((result) => result.athleteId) } },
    select: {
      id: true,
      lastName: true,
      firstName: true,
      middleName: true,
      registration: {
        select: {
          clubName: true,
          city: true,
        },
      },
    },
  })
  const athleteById = new Map(
    athletes.map((athlete) => [
      athlete.id,
      {
        name: formatAthleteFullName(athlete),
        clubName: athlete.registration.clubName,
        city: athlete.registration.city,
      },
    ]),
  )

  const bracketDetailsByAthleteDiscipline = new Map<string, typeof data.bracketDetails>()
  for (const detail of data.bracketDetails) {
    const key = `${detail.athleteId}::${detail.discipline}`
    const bucket = bracketDetailsByAthleteDiscipline.get(key) ?? []
    bucket.push(detail)
    bracketDetailsByAthleteDiscipline.set(key, bucket)
  }

  const rows = data.results
    .filter((result) => result.achievedNormRank != null)
    .map((result) => {
      const rankId = result.achievedNormRank as SportRankId
      const key = `${result.athleteId}::${result.discipline}`
      const details = bracketDetailsByAthleteDiscipline.get(key) ?? []
      const matchingBrackets = details
        .filter((detail) => detail.achievedRank === result.achievedNormRank)
        .sort((a, b) => a.categoryKey.localeCompare(b.categoryKey, 'ru'))
        .map((detail) => ({
          categoryKey: detail.categoryKey,
          categoryLabel: getCategoryLabelFromKey(detail.categoryKey),
          placement: detail.placement ?? 0,
          wins: detail.wins,
        }))

      const sourceCategoryKey = pickSourceBracketKey({
        placement: result.displayPlacement,
        wins: result.displayWins,
        matchingBrackets,
      })
      const athlete = athleteById.get(result.athleteId)

      return {
        athleteId: result.athleteId,
        athleteName: athlete?.name ?? result.athleteId,
        clubName: athlete?.clubName ?? '',
        city: athlete?.city ?? '',
        discipline: result.discipline,
        disciplineLabel: getDisciplineShortLabel(result.discipline),
        resultLabel: formatNormRankLabel(rankId),
        categoryLabel:
          sourceCategoryKey != null ? getCategoryLabelFromKey(sourceCategoryKey) : null,
        placement: result.displayPlacement,
        wins: result.displayWins,
        achievedNormRank: rankId,
        matchingBrackets: matchingBrackets.map((bracket) => ({
          categoryKey: bracket.categoryKey,
          categoryLabel: bracket.categoryLabel,
          placement: bracket.placement,
          wins: bracket.wins,
        })),
      }
    })

  return sortNormQualificationRows(rows)
}

export async function getPublicNormQualifications(): Promise<NormQualificationsResponse> {
  const empty: NormQualificationsResponse = {
    available: false,
    publishedAt: null,
    disclaimer: NORM_QUALIFICATIONS_DISCLAIMER,
    rows: [],
  }

  if (await isEventFinalized()) {
    await maybeRecalculateOnEventFinalized()
  }

  const settings = await getNormQualificationSettings()
  if (!settings.publicEnabled || !(await hasNormQualificationData())) {
    return empty
  }

  const [results, bracketDetails, settingRow] = await Promise.all([
    prisma.rankQualificationResult.findMany({
      where: {
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        achievedNormRank: { not: null },
      },
      orderBy: [{ athleteId: 'asc' }, { discipline: 'asc' }],
    }),
    prisma.rankQualificationBracketDetail.findMany({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    }),
    prisma.rankQualificationSetting.findUnique({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
      select: { calculatedAt: true },
    }),
  ])

  const rows = await buildNormQualificationPublicRows({
    calculatedAt: settingRow?.calculatedAt ?? null,
    results,
    bracketDetails,
  })

  return {
    available: true,
    publishedAt: settingRow?.calculatedAt?.toISOString() ?? null,
    disclaimer: NORM_QUALIFICATIONS_DISCLAIMER,
    rows,
  }
}
