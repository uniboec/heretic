import { describe, expect, it } from 'vitest'
import {
  buildCategoryWeightResults,
  checkWeightForCategory,
  isWeightEligibleFromCategoryResults,
} from '../weightCheck'
import { computeWeightStatus } from '../computeWeightStatus'
import { computeCategoryFingerprint } from '../categoryFingerprint'

const WEIGHT_CATEGORY_66 = 'm_juniors_1_w_le_66'
const WEIGHT_CATEGORY_OVER_61 = 'm_youths_2_w_gt_61'

describe('checkWeightForCategory', () => {
  it('passes at upper bound for max-weight categories', () => {
    expect(checkWeightForCategory(65.99, WEIGHT_CATEGORY_66)).toBe('PASSED')
    expect(checkWeightForCategory(66.0, WEIGHT_CATEGORY_66)).toBe('PASSED')
    expect(checkWeightForCategory(66.01, WEIGHT_CATEGORY_66)).toBe('OVER_LIMIT')
  })

  it('uses strict greater-than semantics for min-weight categories', () => {
    expect(checkWeightForCategory(61.0, WEIGHT_CATEGORY_OVER_61)).toBe('UNDER_LIMIT')
    expect(checkWeightForCategory(61.01, WEIGHT_CATEGORY_OVER_61)).toBe('PASSED')
  })

  it('returns NOT_APPLICABLE for unknown categories', () => {
    expect(checkWeightForCategory(80, 'unknown_category')).toBe('NOT_APPLICABLE')
  })
})

describe('buildCategoryWeightResults', () => {
  it('does not fail eligibility when one category is NOT_APPLICABLE', () => {
    const results = buildCategoryWeightResults(82.3, [
      'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_77',
      'tactic_control:novice:m_juniors_1:unknown_absolute',
    ])
    expect(results.some((row) => row.result === 'NOT_APPLICABLE')).toBe(true)
    expect(isWeightEligibleFromCategoryResults(results)).toBe(false)
  })

  it('keeps weightEligible true when all categories are NOT_APPLICABLE', () => {
    const categoryKeys = ['tactic_control:novice:m_juniors_1:unknown_absolute']
    const results = buildCategoryWeightResults(82.3, categoryKeys)
    expect(results.every((row) => row.result === 'NOT_APPLICABLE')).toBe(true)
    expect(isWeightEligibleFromCategoryResults(results)).toBe(true)

    const status = computeWeightStatus({
      check: {
        weightCheckMode: 'AUTO',
        actualWeightKg: 82.3,
        manualWeightVerified: false,
        manualWeightCategoryFingerprint: null,
      },
      categoryKeys,
    })
    expect(status.hasWeighIn).toBe(true)
    expect(status.weightEligible).toBe(true)
  })
})

describe('computeWeightStatus', () => {
  it('separates hasWeighIn from weightEligible in AUTO mode', () => {
    const status = computeWeightStatus({
      check: {
        weightCheckMode: 'AUTO',
        actualWeightKg: 70,
        manualWeightVerified: false,
        manualWeightCategoryFingerprint: null,
      },
      categoryKeys: ['tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66'],
    })
    expect(status.hasWeighIn).toBe(true)
    expect(status.weightEligible).toBe(false)
  })

  it('treats MANUAL_ISSUE as weighed in with weight problem', () => {
    const status = computeWeightStatus({
      check: {
        weightCheckMode: 'MANUAL_ISSUE',
        actualWeightKg: null,
        manualWeightVerified: false,
        manualWeightCategoryFingerprint: null,
      },
      categoryKeys: ['tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66'],
    })
    expect(status.hasWeighIn).toBe(true)
    expect(status.weightEligible).toBe(false)
    expect(status.manualStale).toBe(false)
  })

  it('marks manual confirmation stale when categories change', () => {
    const status = computeWeightStatus({
      check: {
        weightCheckMode: 'MANUAL',
        actualWeightKg: null,
        manualWeightVerified: true,
        manualWeightCategoryFingerprint: computeCategoryFingerprint(['cat-a']),
      },
      categoryKeys: ['cat-a', 'cat-b'],
    })
    expect(status.hasWeighIn).toBe(true)
    expect(status.weightEligible).toBe(false)
    expect(status.manualStale).toBe(true)
  })
})

describe('computeCategoryFingerprint', () => {
  it('deduplicates category keys before hashing', () => {
    const fingerprint = computeCategoryFingerprint(['cat-b', 'cat-a', 'cat-a', 'cat-b'])
    expect(fingerprint).toBe('cat-a|cat-b')
  })
})
