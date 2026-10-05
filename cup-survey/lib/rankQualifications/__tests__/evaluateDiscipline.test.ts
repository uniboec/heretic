import { describe, expect, it } from 'vitest'
import { aggregateDisciplineResults, pickSourceBracketDetail } from '../evaluateDiscipline'
import type { EvaluatedBracketDetail } from '../types'

function detail(
  partial: Partial<EvaluatedBracketDetail> & Pick<EvaluatedBracketDetail, 'categoryKey' | 'achievedRank'>,
): EvaluatedBracketDetail {
  return {
    athleteId: 'athlete-1',
    discipline: 'tactic_control',
    placement: 1,
    wins: 1,
    isAgeUp: false,
    evskAgeBand: 'youth',
    evskRuleSnapshot: null,
    ...partial,
  }
}

describe('evaluateDiscipline', () => {
  it('picks source bracket by placement then wins then categoryKey', () => {
    const matching = [
      detail({ categoryKey: 'cat-b', placement: 2, wins: 3, achievedRank: 'youth_2' }),
      detail({ categoryKey: 'cat-a', placement: 1, wins: 3, achievedRank: 'youth_2' }),
      detail({ categoryKey: 'cat-c', placement: 1, wins: 2, achievedRank: 'youth_2' }),
    ]
    const source = pickSourceBracketDetail(matching, 'youth_2')
    expect(source?.categoryKey).toBe('cat-a')
  })

  it('aggregates max norm across brackets without mixing wins', () => {
    const bracketDetails: EvaluatedBracketDetail[] = [
      detail({ categoryKey: 'cat-a', placement: 1, wins: 2, achievedRank: 'youth_2' }),
      detail({ categoryKey: 'cat-b', placement: 3, wins: 3, achievedRank: 'youth_3' }),
    ]

    const results = aggregateDisciplineResults({
      bracketDetails,
      displayNameByAthleteId: new Map([['athlete-1', 'Иванов Иван']]),
    })

    expect(results).toHaveLength(1)
    expect(results[0]?.achievedNormRank).toBe('youth_2')
    expect(results[0]?.displayPlacement).toBe(1)
    expect(results[0]?.displayWins).toBe(2)
    expect(results[0]?.matchingCategoryKeys).toEqual(['cat-a'])
  })
})
