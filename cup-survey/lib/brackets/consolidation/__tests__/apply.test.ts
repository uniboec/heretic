import { describe, expect, it } from 'vitest'
import { createConsolidationPlanToken, assertPlanTokenMatches } from '../planToken'
import { hashPlan } from '../planFingerprint'
import { TEST_CONSOLIDATION_POLICY } from './fixtures'

describe('applyConsolidation tokens', () => {
  it('detects stale plan via planFingerprint mismatch', () => {
    const plan = {
      finalPlacements: [
        {
          entryId: 'e1',
          fromCategoryKey: 'a',
          finalCategoryKey: 'b',
        },
      ],
      trace: [],
      skipped: [],
      affectedCategoryKeys: ['a', 'b'],
    }
    const token = createConsolidationPlanToken({
      generationId: 'gen-1',
      generationVersion: 3,
      policy: TEST_CONSOLIDATION_POLICY,
      plan,
    })

    const payload = JSON.parse(
      Buffer.from(token.split('.')[0], 'base64url').toString('utf8'),
    )

    expect(() =>
      assertPlanTokenMatches({
        token: payload,
        generationId: 'gen-1',
        generationVersion: 3,
        policy: TEST_CONSOLIDATION_POLICY,
        plan: { ...plan, finalPlacements: [] },
      }),
    ).toThrowError(expect.objectContaining({ code: 'CONSOLIDATION_PLAN_CHANGED' }))
  })

  it('uses full plan fingerprint, not only final placements length', () => {
    const base = {
      finalPlacements: [
        {
          entryId: 'e1',
          fromCategoryKey: 'a',
          finalCategoryKey: 'b',
        },
      ],
      trace: [
        {
          hopIndex: 0,
          stepIndex: 0,
          entryIds: ['e1'],
          fromCategoryKey: 'a',
          toCategoryKey: 'b',
          actions: [{ type: 'WEIGHT_UP' as const }],
          step: 'WEIGHT_UP' as const,
        },
      ],
      skipped: [],
      affectedCategoryKeys: ['a', 'b'],
    }
    const changedTrace = {
      ...base,
      trace: [{ ...base.trace[0], hopIndex: 1 }],
    }
    expect(hashPlan(base)).not.toBe(hashPlan(changedTrace))
  })
})
