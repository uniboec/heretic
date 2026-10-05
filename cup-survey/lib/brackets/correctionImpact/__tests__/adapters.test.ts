import { describe, expect, it } from 'vitest'
import { getCorrectionImpactAdapter } from '../index'

describe('correctionImpact adapters', () => {
  it('returns metadata-only preview when winner unchanged', () => {
    const adapter = getCorrectionImpactAdapter('olympic')
    const preview = adapter.preview({
      sourceBoutId: 'bout-1',
      categoryKey: 'cat-1',
      systemId: 'olympic',
      previousWinnerEntryId: 'winner-1',
      newWinnerEntryId: 'winner-1',
      downstreamBoutIds: ['bout-2'],
    })

    expect(preview.correctionMode).toBe('METADATA_ONLY')
    expect(preview.invalidatedBoutIds).toEqual([])
  })

  it('uses round-robin adapter for standings-aware categories', () => {
    const adapter = getCorrectionImpactAdapter('round_robin')
    expect(adapter.systemId).toBe('round_robin')
    const preview = adapter.preview({
      sourceBoutId: 'bout-1',
      categoryKey: 'cat-1',
      systemId: 'round_robin',
      previousWinnerEntryId: 'winner-1',
      newWinnerEntryId: 'winner-2',
      downstreamBoutIds: [],
    })
    expect(preview.correctionMode).toBe('SAFE_CASCADE')
  })

  it('resolves three_way adapter (underscore id)', () => {
    const adapter = getCorrectionImpactAdapter('three_way')
    expect(adapter.systemId).toBe('olympic')
    const preview = adapter.preview({
      sourceBoutId: 'bout-1',
      categoryKey: 'cat-1',
      systemId: 'three_way',
      previousWinnerEntryId: 'winner-1',
      newWinnerEntryId: 'winner-2',
      downstreamBoutIds: ['bout-2'],
    })
    expect(preview.correctionMode).toBe('BRANCH_RECOVERY')
  })

  it('invalidates downstream bouts on branch recovery', () => {
    const adapter = getCorrectionImpactAdapter('olympic')
    const preview = adapter.preview({
      sourceBoutId: 'bout-1',
      categoryKey: 'cat-1',
      systemId: 'olympic',
      previousWinnerEntryId: 'winner-1',
      newWinnerEntryId: 'winner-2',
      downstreamBoutIds: ['bout-2', 'bout-3'],
    })

    expect(preview.correctionMode).toBe('BRANCH_RECOVERY')
    expect(preview.invalidatedBoutIds).toEqual(['bout-2', 'bout-3'])
  })
})
