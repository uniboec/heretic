import { describe, expect, it } from 'vitest'
import { applyConsolidationPolicyChange } from '../../../../components/admin/brackets/consolidationDialogState'
import { TEST_CONSOLIDATION_POLICY, legacyPolicy, legacyStep } from './fixtures'

describe('consolidation dialog state', () => {
  it('clears preview and error when policy changes after preview', () => {
    const nextPolicy = legacyPolicy({
      steps: [legacyStep('WEIGHT_UP'), legacyStep('EXPERIENCE_UP')],
    })

    const next = applyConsolidationPolicyChange(nextPolicy)

    expect(next.policy).toEqual(nextPolicy)
    expect(next.preview).toBeNull()
    expect(next.error).toBeNull()
  })
})
