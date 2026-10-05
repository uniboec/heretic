import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONSOLIDATION_POLICY } from '../../../../components/admin/brackets/consolidationClientDefaults'
import {
  loadConsolidationPolicy,
  saveConsolidationPolicy,
} from '../../../../components/admin/brackets/consolidationPolicyStorage'
import { legacyPolicy, legacyStep } from './fixtures'

describe('consolidationPolicyStorage', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.stubGlobal('window', {} as Window)
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      clear: () => store.clear(),
    })
  })

  it('returns client default when storage is empty', () => {
    expect(loadConsolidationPolicy()).toEqual(DEFAULT_CONSOLIDATION_POLICY)
  })

  it('round-trips policy after save', () => {
    const custom = legacyPolicy({
      incompleteThreshold: 2,
      steps: [legacyStep('WEIGHT_UP'), legacyStep('AGE_UP')],
    })
    saveConsolidationPolicy(custom)
    expect(loadConsolidationPolicy()).toEqual(custom)
  })

  it('falls back to default for invalid JSON', () => {
    store.set('bracket-consolidation-policy:v1', '{not-json')
    expect(loadConsolidationPolicy()).toEqual(DEFAULT_CONSOLIDATION_POLICY)
  })
})
