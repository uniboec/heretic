import type { SportRankId } from '@/lib/config/ranks'
import type { EvskAgeBand, EvskEventLevel, EvskRuleSnapshot } from './types'

interface EvskNormRule {
  minWins: number
  placementFrom: number
  placementTo: number
  rankId: SportRankId
}

const REGIONAL_CUP_RULES: Record<EvskAgeBand, EvskNormRule[]> = {
  child: [
    { minWins: 3, placementFrom: 1, placementTo: 2, rankId: 'child_2' },
    { minWins: 3, placementFrom: 3, placementTo: 3, rankId: 'child_3' },
    { minWins: 2, placementFrom: 1, placementTo: 1, rankId: 'child_2' },
    { minWins: 2, placementFrom: 2, placementTo: 3, rankId: 'child_3' },
    { minWins: 1, placementFrom: 1, placementTo: 2, rankId: 'child_3' },
  ],
  youth: [
    { minWins: 3, placementFrom: 1, placementTo: 1, rankId: 'youth_2' },
    { minWins: 3, placementFrom: 2, placementTo: 3, rankId: 'youth_3' },
    { minWins: 2, placementFrom: 1, placementTo: 2, rankId: 'youth_3' },
    { minWins: 1, placementFrom: 1, placementTo: 1, rankId: 'youth_3' },
  ],
  adult: [
    { minWins: 3, placementFrom: 1, placementTo: 1, rankId: 'adult_1' },
    { minWins: 3, placementFrom: 2, placementTo: 3, rankId: 'adult_2' },
    { minWins: 2, placementFrom: 1, placementTo: 1, rankId: 'adult_2' },
    { minWins: 2, placementFrom: 2, placementTo: 3, rankId: 'adult_3' },
    { minWins: 1, placementFrom: 1, placementTo: 2, rankId: 'adult_3' },
  ],
}

export function getEvskAgeBand(actualAge: number): EvskAgeBand | null {
  if (actualAge < 4) return null
  if (actualAge <= 11) return 'child'
  if (actualAge <= 17) return 'youth'
  return 'adult'
}

export function evaluateEvskNorm(input: {
  placement: number
  wins: number
  ageBand: EvskAgeBand
  eventLevel: EvskEventLevel
}): { rankId: SportRankId; rule: EvskRuleSnapshot } | null {
  const rules = REGIONAL_CUP_RULES[input.ageBand]
  for (const rule of rules) {
    if (
      input.wins >= rule.minWins &&
      input.placement >= rule.placementFrom &&
      input.placement <= rule.placementTo
    ) {
      return {
        rankId: rule.rankId,
        rule: {
          eventLevel: input.eventLevel,
          ageBand: input.ageBand,
          minWins: rule.minWins,
          placementFrom: rule.placementFrom,
          placementTo: rule.placementTo,
          rankId: rule.rankId,
        },
      }
    }
  }
  return null
}
