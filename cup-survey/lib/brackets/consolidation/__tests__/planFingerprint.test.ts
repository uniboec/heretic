import { describe, expect, it } from 'vitest'
import { hashPlan, canonicalTrace } from '../planFingerprint'
import type { ConsolidationPlan } from '../types'

describe('planFingerprint', () => {
  const basePlan = (): ConsolidationPlan => ({
    finalPlacements: [
      {
        entryId: 'e1',
        fromCategoryKey: 'tactic_control:beginner:m_juniors_1:w_55',
        finalCategoryKey: 'tactic_control:beginner:m_juniors_1:w_60',
      },
    ],
    trace: [
      {
        hopIndex: 0,
        stepIndex: 0,
        entryIds: ['e1'],
        fromCategoryKey: 'tactic_control:beginner:m_juniors_1:w_55',
        toCategoryKey: 'tactic_control:beginner:m_juniors_1:w_60',
        actions: [{ type: 'WEIGHT_UP' as const }],
        step: 'WEIGHT_UP',
      },
    ],
    skipped: [],
    affectedCategoryKeys: [
      'tactic_control:beginner:m_juniors_1:w_55',
      'tactic_control:beginner:m_juniors_1:w_60',
    ],
  })

  it('same finalPlacements but different trace hop order produce different fingerprints', () => {
    const planA = basePlan()
    const planB: ConsolidationPlan = {
      ...basePlan(),
      trace: [
        {
          hopIndex: 1,
          stepIndex: 0,
          entryIds: ['e1'],
          fromCategoryKey: 'tactic_control:beginner:m_juniors_1:w_55',
          toCategoryKey: 'tactic_control:beginner:m_juniors_1:w_60',
          actions: [{ type: 'WEIGHT_UP' }],
          step: 'WEIGHT_UP',
        },
        {
          hopIndex: 0,
          stepIndex: 1,
          entryIds: ['e1'],
          fromCategoryKey: 'tactic_control:beginner:m_juniors_1:w_60',
          toCategoryKey: 'tactic_control:beginner:m_juniors_2:w_60',
          actions: [{ type: 'AGE_UP', weightMapping: 'SAME_INDEX' }],
          step: 'AGE_UP',
        },
      ],
    }

    expect(hashPlan(planA)).not.toBe(hashPlan(planB))
  })

  it('reordered hopIndex values change fingerprint', () => {
    const planA = basePlan()
    const planB = {
      ...basePlan(),
      trace: [{ ...basePlan().trace[0], hopIndex: 1 }],
    }
    expect(hashPlan(planA)).not.toBe(hashPlan(planB))
  })

  it('canonicalTrace preserves hop order by hopIndex', () => {
    const trace = canonicalTrace({
      ...basePlan(),
      trace: [
        { ...basePlan().trace[0], hopIndex: 2, actions: [{ type: 'WEIGHT_UP' as const }] },
        { ...basePlan().trace[0], hopIndex: 0, step: 'AGE_UP' as const, actions: [{ type: 'AGE_UP' as const, weightMapping: 'SAME_INDEX' }] },
        { ...basePlan().trace[0], hopIndex: 1, step: 'EXPERIENCE_UP' as const, actions: [{ type: 'EXPERIENCE_UP' as const }] },
      ],
    })
    expect(trace.map((hop) => hop.hopIndex)).toEqual([0, 1, 2])
  })
})
