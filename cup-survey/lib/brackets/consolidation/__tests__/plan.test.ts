import { describe, expect, it } from 'vitest'
import { buildConsolidationPlan, buildVirtualComposition } from '../plan'
import type { ConsolidationAthleteContext } from '../eligibility'
import { TEST_CONSOLIDATION_POLICY, TEST_FORMAT_RULES, legacyPolicy, legacyStep } from './fixtures'

const W48 = 'm_juniors_1_w_le_48'
const W52 = 'm_juniors_1_w_le_52'
const W56 = 'm_juniors_1_w_le_56'
const W66 = 'm_juniors_1_w_le_66'

const CAT_48 = `tactic_control:beginner:m_juniors_1:${W48}`
const CAT_52 = `tactic_control:beginner:m_juniors_1:${W52}`
const CAT_56 = `tactic_control:beginner:m_juniors_1:${W56}`
const CAT_66 = `tactic_control:beginner:m_juniors_1:${W66}`

const defaultRules = TEST_FORMAT_RULES

function athlete(entryId: string): ConsolidationAthleteContext {
  return {
    entryId,
    birthDate: '2012-01-01',
    gender: 'male',
  }
}

describe('buildConsolidationPlan', () => {
  it('does not treat empty category as incomplete', () => {
    const virtual = buildVirtualComposition([
      { entryId: 'e1', effectiveCategoryKey: CAT_48 },
      { entryId: 'e2', effectiveCategoryKey: CAT_66 },
    ])
    const drawParticipantCounts = new Map<string, number>([
      [CAT_48, 1],
      [CAT_66, 2],
      [`tactic_control:beginner:m_juniors_1:${W56}`, 0],
    ])

    const plan = buildConsolidationPlan({
      policy: { ...TEST_CONSOLIDATION_POLICY, incompleteThreshold: 2 },
      virtual,
      sourceByEntry: new Map([
        ['e1', CAT_48],
        ['e2', CAT_66],
      ]),
      athleteContexts: new Map([
        ['e1', athlete('e1')],
        ['e2', athlete('e2')],
      ]),
      formatRules: defaultRules,
      drawParticipantCounts,
    })

    expect(plan.trace.some((hop) => hop.fromCategoryKey.includes(W56))).toBe(false)
  })

  it('requires sourceCount > 0', () => {
    const virtual = buildVirtualComposition([])
    virtual.set(CAT_48, [])

    const plan = buildConsolidationPlan({
      policy: TEST_CONSOLIDATION_POLICY,
      virtual,
      sourceByEntry: new Map(),
      athleteContexts: new Map(),
      formatRules: defaultRules,
      drawParticipantCounts: new Map([[CAT_48, 0]]),
    })

    expect(plan.finalPlacements).toHaveLength(0)
    expect(plan.trace).toHaveLength(0)
  })

  it('can multi-hop lighter -> next weight -> older division when targets exist', () => {
    const W56_J2 = 'm_juniors_2_w_le_56'
    const CAT_J2_56 = `tactic_control:beginner:m_juniors_2:${W56_J2}`
    const virtual = buildVirtualComposition([{ entryId: 'e1', effectiveCategoryKey: CAT_48 }])
    virtual.set(CAT_52, ['e2', 'e3'])
    virtual.set(CAT_J2_56, ['e4', 'e5'])

    const policy = legacyPolicy({
      incompleteThreshold: 1,
      steps: [
        legacyStep('WEIGHT_UP'),
        legacyStep('AGE_UP'),
        legacyStep('EXPERIENCE_UP', false),
      ],
    })

    const plan = buildConsolidationPlan({
      policy,
      virtual,
      sourceByEntry: new Map([['e1', CAT_48]]),
      athleteContexts: new Map([['e1', athlete('e1')]]),
      formatRules: defaultRules,
      drawParticipantCounts: new Map([
        [CAT_48, 1],
        [CAT_52, 2],
        [CAT_J2_56, 2],
      ]),
    })

    expect(plan.trace.length).toBeGreaterThanOrEqual(1)
    expect(plan.finalPlacements[0]?.finalCategoryKey).not.toBe(CAT_48)
  })

  it('does not replan athletes already sitting in consolidated categories', () => {
    const virtual = buildVirtualComposition([{ entryId: 'e1', effectiveCategoryKey: CAT_52 }])
    virtual.set(CAT_52, ['e1', 'e2', 'e3'])

    const plan = buildConsolidationPlan({
      policy: legacyPolicy({
        incompleteThreshold: 1,
        steps: [legacyStep('WEIGHT_UP')],
      }),
      virtual,
      sourceByEntry: new Map([['e1', CAT_48]]),
      athleteContexts: new Map([['e1', athlete('e1')]]),
      formatRules: defaultRules,
      drawParticipantCounts: new Map([
        [CAT_48, 0],
        [CAT_52, 3],
      ]),
    })

    expect(plan.trace).toHaveLength(0)
    expect(plan.finalPlacements).toHaveLength(0)
  })

  it('does not cascade within a wave when target stays incomplete', () => {
    const virtual = buildVirtualComposition([
      { entryId: 'solo-a', effectiveCategoryKey: CAT_48 },
      { entryId: 'solo-b', effectiveCategoryKey: CAT_52 },
    ])
    virtual.set(CAT_56, ['target-1', 'target-2', 'target-3'])

    const plan = buildConsolidationPlan({
      policy: {
        incompleteThreshold: 2,
        steps: [{ enabled: true, actions: [{ type: 'WEIGHT_UP' }] }],
      },
      virtual,
      sourceByEntry: new Map([
        ['solo-a', CAT_48],
        ['solo-b', CAT_52],
      ]),
      athleteContexts: new Map([
        ['solo-a', athlete('solo-a')],
        ['solo-b', athlete('solo-b')],
      ]),
      formatRules: defaultRules,
      drawParticipantCounts: new Map([
        [CAT_48, 1],
        [CAT_52, 1],
        [CAT_56, 3],
      ]),
    })

    const hopsFrom48 = plan.trace.filter((hop) => hop.fromCategoryKey === CAT_48)
    const hopsFrom52 = plan.trace.filter((hop) => hop.fromCategoryKey === CAT_52)
    expect(hopsFrom48).toHaveLength(1)
    expect(hopsFrom52).toHaveLength(0)
  })

  it('records composite actions in a single trace hop without step field', () => {
    const W61_J2 = 'm_juniors_2_w_le_61'
    const CAT_J2_61 = `tactic_control:beginner:m_juniors_2:${W61_J2}`
    const virtual = buildVirtualComposition([{ entryId: 'e1', effectiveCategoryKey: CAT_48 }])
    virtual.set(CAT_J2_61, ['e2', 'e3'])

    const plan = buildConsolidationPlan({
      policy: {
        incompleteThreshold: 1,
        steps: [
          {
            enabled: true,
            actions: [
              { type: 'AGE_UP', weightMapping: 'CLOSEST_KG' },
              { type: 'WEIGHT_UP' },
            ],
          },
        ],
      },
      virtual,
      sourceByEntry: new Map([['e1', CAT_48]]),
      athleteContexts: new Map([
        ['e1', { entryId: 'e1', birthDate: '2008-01-01', gender: 'male' as const }],
      ]),
      formatRules: defaultRules,
      drawParticipantCounts: new Map([
        [CAT_48, 1],
        [CAT_J2_61, 2],
      ]),
    })

    expect(plan.trace).toHaveLength(1)
    expect(plan.trace[0]?.actions).toHaveLength(2)
    expect(plan.trace[0]?.step).toBeUndefined()
  })

  it('does not move when final target category is empty', () => {
    const virtual = buildVirtualComposition([{ entryId: 'e1', effectiveCategoryKey: CAT_48 }])
    virtual.set(CAT_52, [])

    const plan = buildConsolidationPlan({
      policy: {
        incompleteThreshold: 1,
        steps: [{ enabled: true, actions: [{ type: 'WEIGHT_UP' }] }],
      },
      virtual,
      sourceByEntry: new Map([['e1', CAT_48]]),
      athleteContexts: new Map([['e1', athlete('e1')]]),
      formatRules: defaultRules,
      drawParticipantCounts: new Map([
        [CAT_48, 1],
        [CAT_52, 2],
      ]),
    })

    expect(plan.trace).toHaveLength(0)
    expect(plan.finalPlacements).toHaveLength(0)
    expect(plan.skipped.some((item) => item.entryIds?.includes('e1'))).toBe(true)
  })

  it('does not confuse impossible chain with empty final target', () => {
    const virtual = buildVirtualComposition([{ entryId: 'e1', effectiveCategoryKey: CAT_48 }])
    virtual.set(CAT_52, ['e2', 'e3'])

    const impossiblePlan = buildConsolidationPlan({
      policy: {
        incompleteThreshold: 1,
        steps: [{ enabled: true, actions: [{ type: 'AGE_UP', repeat: 99 as never }] }],
      },
      virtual,
      sourceByEntry: new Map([['e1', CAT_48]]),
      athleteContexts: new Map([['e1', athlete('e1')]]),
      formatRules: defaultRules,
      drawParticipantCounts: new Map([
        [CAT_48, 1],
        [CAT_52, 2],
      ]),
    })

    const emptyTargetVirtual = buildVirtualComposition([
      { entryId: 'e1', effectiveCategoryKey: CAT_48 },
    ])
    emptyTargetVirtual.set(CAT_52, [])

    const emptyTargetPlan = buildConsolidationPlan({
      policy: {
        incompleteThreshold: 1,
        steps: [{ enabled: true, actions: [{ type: 'WEIGHT_UP' }] }],
      },
      virtual: emptyTargetVirtual,
      sourceByEntry: new Map([['e1', CAT_48]]),
      athleteContexts: new Map([['e1', athlete('e1')]]),
      formatRules: defaultRules,
      drawParticipantCounts: new Map([
        [CAT_48, 1],
        [CAT_52, 2],
      ]),
    })

    expect(impossiblePlan.trace).toHaveLength(0)
    expect(emptyTargetPlan.trace).toHaveLength(0)
    expect(impossiblePlan.skipped[0]?.reason).toBe('NO_CANDIDATE')
    expect(emptyTargetPlan.skipped[0]?.reason).toBe('NO_CANDIDATE')
  })

  it('lists only final unmoved incomplete categories in skipped', () => {
    const virtual = buildVirtualComposition([
      { entryId: 'solo-a', effectiveCategoryKey: CAT_48 },
      { entryId: 'solo-b', effectiveCategoryKey: CAT_52 },
      { entryId: 'pair', effectiveCategoryKey: CAT_56 },
      { entryId: 'pair-2', effectiveCategoryKey: CAT_56 },
    ])
    virtual.set(CAT_66, ['solo-c'])

    const plan = buildConsolidationPlan({
      policy: legacyPolicy({
        incompleteThreshold: 1,
        steps: [legacyStep('WEIGHT_UP'), legacyStep('EXPERIENCE_UP')],
      }),
      virtual,
      sourceByEntry: new Map([
        ['solo-a', CAT_48],
        ['solo-b', CAT_52],
        ['pair', CAT_56],
        ['pair-2', CAT_56],
        ['solo-c', CAT_66],
      ]),
      athleteContexts: new Map([
        ['solo-a', athlete('solo-a')],
        ['solo-b', athlete('solo-b')],
        ['pair', athlete('pair')],
        ['pair-2', athlete('pair-2')],
        ['solo-c', athlete('solo-c')],
      ]),
      formatRules: defaultRules,
      drawParticipantCounts: new Map([
        [CAT_48, 1],
        [CAT_52, 1],
        [CAT_56, 2],
        [CAT_66, 1],
      ]),
    })

    const skippedIds = plan.skipped.flatMap((item) => item.entryIds ?? [])
    for (const entryId of skippedIds) {
      expect(plan.finalPlacements.some((placement) => placement.entryId === entryId)).toBe(false)
    }
    expect(new Set(skippedIds).size).toBe(skippedIds.length)
    expect(plan.skipped.every((item) => (item.entryIds?.length ?? 0) <= 1)).toBe(true)
  })
})
