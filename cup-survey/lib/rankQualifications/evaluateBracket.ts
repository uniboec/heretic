import { getAthleteAgeOnTournamentDate, isAgeUpDivision } from '@/lib/registration/categoryRules'
import { parseRegistrationCategoryKey } from '@/lib/registration/categoryIdentity'
import { countOfficialWins } from './countOfficialWins'
import { evaluateEvskNorm, getEvskAgeBand } from './evskNorms'
import type {
  EvaluatedBracketDetail,
  NormQualificationBoutResult,
  NormQualificationCategorySource,
} from './types'

export function evaluateBracketForParticipant(input: {
  category: NormQualificationCategorySource
  entryId: string
  athleteId: string
  birthDate: string
  gender: string
  placement: number
  boutResults: readonly NormQualificationBoutResult[]
}): EvaluatedBracketDetail | null {
  const actualAge = getAthleteAgeOnTournamentDate(input.birthDate)
  if (actualAge == null) return null

  const ageBand = getEvskAgeBand(actualAge)
  if (!ageBand) return null

  const wins = countOfficialWins(input.entryId, input.boutResults)
  const evaluated = evaluateEvskNorm({
    placement: input.placement,
    wins,
    ageBand,
    eventLevel: 'regional_cup',
  })

  const identity = parseRegistrationCategoryKey(input.category.categoryKey)
  const isAgeUp =
    identity != null
      ? isAgeUpDivision(input.birthDate, input.gender, identity.ageDivisionId)
      : false

  return {
    categoryKey: input.category.categoryKey,
    athleteId: input.athleteId,
    discipline: input.category.discipline,
    placement: input.placement,
    wins,
    achievedRank: evaluated?.rankId ?? null,
    isAgeUp,
    evskAgeBand: ageBand,
    evskRuleSnapshot: evaluated?.rule ?? null,
  }
}

export function evaluateCategoryBrackets(
  category: NormQualificationCategorySource,
): EvaluatedBracketDetail[] {
  if (!category.result || category.result.status !== 'complete') {
    return []
  }

  const participantByEntryId = new Map(
    category.participants.map((participant) => [participant.entryId, participant]),
  )

  const results: EvaluatedBracketDetail[] = []
  for (const placement of category.result.placements) {
    const participant = participantByEntryId.get(placement.entryId)
    if (!participant) continue

    const detail = evaluateBracketForParticipant({
      category,
      entryId: placement.entryId,
      athleteId: participant.athleteId,
      birthDate: participant.birthDate,
      gender: participant.gender,
      placement: placement.placement,
      boutResults: category.boutResults,
    })
    if (detail) {
      results.push(detail)
    }
  }

  return results
}
