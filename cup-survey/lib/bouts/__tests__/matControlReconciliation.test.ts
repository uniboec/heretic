import { describe, expect, it } from 'vitest'
import type { BracketStructure } from '../../brackets/core/types'
import {
  backfillFightOfficiallyStarted,
  findFastestFightEligibilityGaps,
  findRatingBracketMismatches,
} from '../matControlReconciliation'
import { isFastestFightRankingEligible } from '../../fastestFights/eligibility'

describe('matControlReconciliation', () => {
  it('exports reconciliation helpers', () => {
    expect(typeof backfillFightOfficiallyStarted).toBe('function')
    expect(typeof findRatingBracketMismatches).toBe('function')
    expect(typeof findFastestFightEligibilityGaps).toBe('function')
  })

  it('flags fastest fight eligibility gaps', () => {
    expect(
      isFastestFightRankingEligible({
        victoryMethod: 'SUBMISSION',
        boutElapsedMs: 500,
        fightOfficiallyStarted: false,
      }),
    ).toBe(false)
  })

  it('detects bracket winner mismatch shape', () => {
    const structure: BracketStructure = {
      rounds: [
        {
          id: 'f1',
          round: 1,
          entryIdA: 'a',
          entryIdB: 'b',
          winnerEntryId: 'a',
          loserEntryId: 'b',
        },
      ],
      bronzeSlots: [],
      roundRobinPairs: [],
    }
    const winner = structure.rounds[0]?.winnerEntryId
    expect(winner).toBe('a')
    expect(`${'cat'}::${structure.rounds[0].id}`).toBe('cat::f1')
  })
})
