import { describe, expect, it } from 'vitest'
import { hashPolicy, normalizePolicy, validateConsolidationPolicy, validateStepActions } from '../policyHash'
import { TEST_CONSOLIDATION_POLICY } from './fixtures'

describe('policyHash', () => {
  it('preserves step order in hash', () => {
    const policyA = normalizePolicy({
      incompleteThreshold: 1,
      steps: [
        { enabled: true, actions: [{ type: 'WEIGHT_UP' }] },
        { enabled: true, actions: [{ type: 'AGE_UP', weightMapping: 'SAME_INDEX' }] },
      ],
    })
    const policyB = normalizePolicy({
      incompleteThreshold: 1,
      steps: [
        { enabled: true, actions: [{ type: 'AGE_UP', weightMapping: 'SAME_INDEX' }] },
        { enabled: true, actions: [{ type: 'WEIGHT_UP' }] },
      ],
    })

    expect(hashPolicy(policyA)).not.toBe(hashPolicy(policyB))
  })

  it('preserves action order inside a wave', () => {
    const policyA = normalizePolicy({
      incompleteThreshold: 1,
      steps: [
        {
          enabled: true,
          actions: [{ type: 'AGE_UP', weightMapping: 'SAME_INDEX' }, { type: 'WEIGHT_UP' }],
        },
      ],
    })
    const policyB = normalizePolicy({
      incompleteThreshold: 1,
      steps: [
        {
          enabled: true,
          actions: [{ type: 'WEIGHT_UP' }, { type: 'AGE_UP', weightMapping: 'SAME_INDEX' }],
        },
      ],
    })

    expect(hashPolicy(policyA)).not.toBe(hashPolicy(policyB))
  })

  it('normalizes defaults consistently', () => {
    const hashed = hashPolicy(TEST_CONSOLIDATION_POLICY)
    expect(hashed).toHaveLength(64)
  })

  it('treats omitted repeat and explicit repeat=1 as the same hash', () => {
    const omitted = normalizePolicy({
      incompleteThreshold: 1,
      steps: [{ enabled: true, actions: [{ type: 'WEIGHT_UP' }] }],
    })
    const explicit = normalizePolicy({
      incompleteThreshold: 1,
      steps: [{ enabled: true, actions: [{ type: 'WEIGHT_UP', repeat: 1 }] }],
    })

    expect(hashPolicy(omitted)).toBe(hashPolicy(explicit))
  })

  it('legacy step shape normalizes to actions[]', () => {
    const normalized = validateConsolidationPolicy({
      incompleteThreshold: 1,
      steps: [{ type: 'WEIGHT_UP', enabled: true }],
    })
    expect(normalized?.steps[0]?.actions).toEqual([{ type: 'WEIGHT_UP' }])
  })

  it('rejects missing policy', () => {
    expect(validateConsolidationPolicy(undefined)).toBeNull()
    expect(validateConsolidationPolicy(null)).toBeNull()
  })

  it('rejects empty steps', () => {
    expect(validateConsolidationPolicy({ incompleteThreshold: 1, steps: [] })).toBeNull()
  })

  it('rejects policy without active waves', () => {
    expect(
      validateConsolidationPolicy({
        incompleteThreshold: 1,
        steps: [
          { enabled: false, actions: [{ type: 'EXPERIENCE_UP' }] },
          { enabled: false, actions: [{ type: 'WEIGHT_UP' }] },
        ],
      }),
    ).toBeNull()
  })

  it('accepts valid policy', () => {
    expect(validateConsolidationPolicy(TEST_CONSOLIDATION_POLICY)).toEqual(
      normalizePolicy(TEST_CONSOLIDATION_POLICY),
    )
  })

  it('rejects duplicate axis actions', () => {
    expect(
      validateStepActions([
        { type: 'WEIGHT_UP' },
        { type: 'WEIGHT_UP', repeat: 2 },
      ]),
    ).toBe('DUPLICATE_AXIS')
    expect(
      validateStepActions([{ type: 'AGE_UP' }, { type: 'AGE_UP', repeat: 2 }]),
    ).toBe('DUPLICATE_AXIS')
    expect(
      validateStepActions([{ type: 'EXPERIENCE_UP' }, { type: 'EXPERIENCE_UP' }]),
    ).toBe('DUPLICATE_AXIS')
  })

  it('rejects conflicting weight directions', () => {
    expect(
      validateStepActions([{ type: 'WEIGHT_UP' }, { type: 'WEIGHT_DOWN' }]),
    ).toBe('CONFLICTING_WEIGHT')
  })
})
