import type { ConsolidationPolicy } from '@/lib/brackets/consolidation/types'

export function applyConsolidationPolicyChange(nextPolicy: ConsolidationPolicy): {
  policy: ConsolidationPolicy
  preview: null
  error: null
} {
  return {
    policy: nextPolicy,
    preview: null,
    error: null,
  }
}
