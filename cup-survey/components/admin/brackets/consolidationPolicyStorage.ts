import type { ConsolidationPolicy } from '@/lib/brackets/consolidation/types'
import {
  DEFAULT_CONSOLIDATION_POLICY,
  parseConsolidationPolicy,
} from './consolidationClientDefaults'

const STORAGE_KEY = 'bracket-consolidation-policy:v1'

export function loadConsolidationPolicy(): ConsolidationPolicy {
  if (typeof window === 'undefined') return DEFAULT_CONSOLIDATION_POLICY

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CONSOLIDATION_POLICY
    return parseConsolidationPolicy(JSON.parse(raw))
  } catch {
    return DEFAULT_CONSOLIDATION_POLICY
  }
}

export function saveConsolidationPolicy(policy: ConsolidationPolicy): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(policy))
}
