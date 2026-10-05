import { getStrengthTier } from '@/lib/brackets/core/seeding/strengthTier'
import type { SportRankId } from '@/lib/config/ranks'
import type { EvaluatedBracketDetail, EvaluatedDisciplineResult } from './types'

function compareRankDesc(a: SportRankId, b: SportRankId): number {
  const tierA = getStrengthTier(a) ?? -1
  const tierB = getStrengthTier(b) ?? -1
  return tierB - tierA
}

export function pickSourceBracketDetail(
  details: readonly EvaluatedBracketDetail[],
  achievedNormRank: SportRankId,
): EvaluatedBracketDetail | null {
  const matching = details.filter((detail) => detail.achievedRank === achievedNormRank)
  if (matching.length === 0) return null

  return [...matching].sort((a, b) => {
    if (a.placement !== b.placement) return a.placement - b.placement
    if (a.wins !== b.wins) return b.wins - a.wins
    return a.categoryKey.localeCompare(b.categoryKey, 'ru')
  })[0]!
}

export function aggregateDisciplineResults(input: {
  bracketDetails: readonly EvaluatedBracketDetail[]
  displayNameByAthleteId: ReadonlyMap<string, string>
}): EvaluatedDisciplineResult[] {
  const byAthleteDiscipline = new Map<string, EvaluatedBracketDetail[]>()

  for (const detail of input.bracketDetails) {
    const key = `${detail.athleteId}::${detail.discipline}`
    const bucket = byAthleteDiscipline.get(key) ?? []
    bucket.push(detail)
    byAthleteDiscipline.set(key, bucket)
  }

  const results: EvaluatedDisciplineResult[] = []

  for (const [key, details] of byAthleteDiscipline) {
    const [athleteId, discipline] = key.split('::')
    const achievedRanks = details
      .map((detail) => detail.achievedRank)
      .filter((rank): rank is SportRankId => rank != null)

    if (achievedRanks.length === 0) continue

    const achievedNormRank = [...achievedRanks].sort(compareRankDesc)[0]!
    const matching = details.filter((detail) => detail.achievedRank === achievedNormRank)
    const source = pickSourceBracketDetail(details, achievedNormRank)

    results.push({
      athleteId,
      discipline,
      displayName: input.displayNameByAthleteId.get(athleteId) ?? athleteId,
      achievedNormRank,
      sourceCategoryKey: source?.categoryKey ?? null,
      displayPlacement: source?.placement ?? null,
      displayWins: source?.wins ?? null,
      matchingCategoryKeys: matching.map((detail) => detail.categoryKey),
      evskRuleSnapshot: source?.evskRuleSnapshot ?? null,
    })
  }

  return results.sort((a, b) => {
    const nameCmp = a.displayName.localeCompare(b.displayName, 'ru')
    if (nameCmp !== 0) return nameCmp
    return a.discipline.localeCompare(b.discipline, 'ru')
  })
}
