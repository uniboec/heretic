import type { BracketFormatRuleLike } from '../../core/types'
import { normalizePolicy } from '../policyHash'
import type { ConsolidationPolicy, ConsolidationStepType, LegacyConsolidationStepInput } from '../types'

export const TEST_CONSOLIDATION_POLICY: ConsolidationPolicy = {
  incompleteThreshold: 1,
  steps: [
    { enabled: true, actions: [{ type: 'EXPERIENCE_UP' }] },
    { enabled: true, actions: [{ type: 'WEIGHT_UP' }] },
    { enabled: true, actions: [{ type: 'AGE_UP', weightMapping: 'SAME_INDEX' }] },
  ],
}

export const TEST_FORMAT_RULES: BracketFormatRuleLike[] = [
  {
    minParticipants: 1,
    maxParticipants: 8,
    systemId: 'olympic',
    allowedSystemIds: ['olympic'],
    sortOrder: 0,
    enabled: true,
    defaultBronzeMode: 'TWO',
  },
]

export function legacyPolicy(input: {
  incompleteThreshold?: 1 | 2 | 3
  steps: LegacyConsolidationStepInput[]
}): ConsolidationPolicy {
  return normalizePolicy({
    incompleteThreshold: input.incompleteThreshold ?? 1,
    steps: input.steps,
  })
}

export function legacyStep(type: ConsolidationStepType, enabled = true): LegacyConsolidationStepInput {
  return type === 'AGE_UP'
    ? { type, enabled, weightMapping: 'SAME_INDEX' }
    : { type, enabled }
}
