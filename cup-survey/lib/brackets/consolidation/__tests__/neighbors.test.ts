import { describe, expect, it } from 'vitest'
import {
  applyActionChain,
  applyConsolidationAction,
  buildCandidateKeysForStep,
} from '../neighbors'

const CAT_48 = 'tactic_control:beginner:m_juniors_1:m_juniors_1_w_le_48'
const CAT_52 = 'tactic_control:beginner:m_juniors_1:m_juniors_1_w_le_52'
const CAT_56 = 'tactic_control:beginner:m_juniors_1:m_juniors_1_w_le_56'

describe('applyActionChain', () => {
  it('WEIGHT_UP repeat=2 resolves final weight two steps up', () => {
    const keys = buildCandidateKeysForStep(CAT_48, {
      enabled: true,
      actions: [{ type: 'WEIGHT_UP', repeat: 2 }],
    })
    expect(keys).toEqual([CAT_56])
  })

  it('AGE_UP then WEIGHT_UP differs from WEIGHT_UP then AGE_UP', () => {
    const ageThenWeight = buildCandidateKeysForStep(CAT_48, {
      enabled: true,
      actions: [
        { type: 'AGE_UP', weightMapping: 'CLOSEST_KG' },
        { type: 'WEIGHT_UP' },
      ],
    })
    const weightThenAge = buildCandidateKeysForStep(CAT_48, {
      enabled: true,
      actions: [
        { type: 'WEIGHT_UP' },
        { type: 'AGE_UP', weightMapping: 'CLOSEST_KG' },
      ],
    })
    expect(ageThenWeight[0]).toBeDefined()
    expect(weightThenAge[0]).toBeDefined()
    expect(ageThenWeight[0]).not.toBe(weightThenAge[0])
  })

  it('AGE_UP then WEIGHT_UP repeat=2 resolves final weight two steps up in target division', () => {
    const keys = buildCandidateKeysForStep(CAT_48, {
      enabled: true,
      actions: [{ type: 'AGE_UP', weightMapping: 'SAME_INDEX' }, { type: 'WEIGHT_UP', repeat: 2 }],
    })
    expect(keys).toEqual([
      'tactic_control:beginner:m_juniors_2:m_juniors_2_w_le_66',
    ])
  })

  it('returns empty candidates when chain is impossible', () => {
    const keys = buildCandidateKeysForStep(CAT_48, {
      enabled: true,
      actions: [{ type: 'AGE_UP', repeat: 99 as never }],
    })
    expect(keys).toEqual([])
  })

  it('AGE_UP repeat=2 returns null when intermediate age hop is impossible', () => {
    const identity = {
      discipline: 'tactic_control',
      experienceLevel: 'beginner' as const,
      ageDivisionId: 'm_veterans_3',
      weightCategoryId: 'm_veterans_3_w_le_56',
    }
    expect(
      applyConsolidationAction(identity, {
        type: 'AGE_UP',
        repeat: 2,
        weightMapping: 'SAME_INDEX',
      }),
    ).toBeNull()
  })

  it('applyConsolidationAction applies weightMapping on each AGE_UP repeat hop', () => {
    const identity = {
      discipline: 'tactic_control',
      experienceLevel: 'beginner' as const,
      ageDivisionId: 'm_juniors_1',
      weightCategoryId: 'm_juniors_1_w_le_48',
    }
    const once = applyConsolidationAction(identity, {
      type: 'AGE_UP',
      weightMapping: 'SAME_INDEX',
    })
    const twice = applyConsolidationAction(identity, {
      type: 'AGE_UP',
      repeat: 2,
      weightMapping: 'SAME_INDEX',
    })
    expect(once?.ageDivisionId).not.toBe(identity.ageDivisionId)
    expect(twice?.ageDivisionId).not.toBe(once?.ageDivisionId)
  })

  it('applyActionChain returns null identity chain on invalid hop', () => {
    const identity = {
      discipline: 'tactic_control',
      experienceLevel: 'beginner' as const,
      ageDivisionId: 'm_juniors_1',
      weightCategoryId: 'm_juniors_1_w_le_48',
    }
    expect(
      applyActionChain(identity, [{ type: 'WEIGHT_DOWN', repeat: 99 as never }]),
    ).toBeNull()
  })
})
