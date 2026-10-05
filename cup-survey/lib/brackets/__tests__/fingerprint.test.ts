import { describe, expect, it } from 'vitest'
import {
  buildSeedingSnapshot,
  categoryFingerprintForDraw,
  computeCategoryCompositionFingerprint,
  computeSeedingFingerprint,
  computeSourceCompositionFingerprint,
} from '../core/fingerprint'
import { eligibleEntry } from './fixtures/eligibleEntry'
import type { EligibleEntry } from '../core/types'

const baseEntry = eligibleEntry({
  entryId: 'e1',
  sourceCategoryKey: 'cat-a',
  effectiveCategoryKey: 'cat-b',
  displayName: 'A',
})

describe('seeding fingerprint stability', () => {
  it('sorts by seedPosition then entryId', () => {
    const a = buildSeedingSnapshot('olympic', 1, [
      { entryId: 'b', clubIdentity: 'c1', seedPosition: 2 },
      { entryId: 'a', clubIdentity: 'c1', seedPosition: 1 },
    ])
    const b = buildSeedingSnapshot('olympic', 1, [
      { entryId: 'a', clubIdentity: 'c1', seedPosition: 1 },
      { entryId: 'b', clubIdentity: 'c1', seedPosition: 2 },
    ])
    expect(computeSeedingFingerprint(a)).toBe(computeSeedingFingerprint(b))
  })

  it('changes when system version changes', () => {
    const v1 = buildSeedingSnapshot('olympic', 1, [
      { entryId: 'a', clubIdentity: 'c1', seedPosition: 1 },
    ])
    const v2 = buildSeedingSnapshot('olympic', 2, [
      { entryId: 'a', clubIdentity: 'c1', seedPosition: 1 },
    ])
    expect(computeSeedingFingerprint(v1)).not.toBe(computeSeedingFingerprint(v2))
  })
})

describe('composition fingerprints', () => {
  it('generation fingerprint ignores manual placement category', () => {
    const withPlacement: EligibleEntry = {
      ...baseEntry,
      effectiveCategoryKey: 'cat-b',
    }
    const withoutPlacement: EligibleEntry = {
      ...baseEntry,
      effectiveCategoryKey: 'cat-a',
    }
    expect(computeSourceCompositionFingerprint([withPlacement])).toBe(
      computeSourceCompositionFingerprint([withoutPlacement]),
    )
  })

  it('category fingerprint includes effectiveCategoryKey', () => {
    const sameIds = categoryFingerprintForDraw('cat-a', ['e1'])
    const differentKey = computeCategoryCompositionFingerprint([
      { entryId: 'e1', effectiveCategoryKey: 'cat-b' },
    ])
    expect(sameIds).not.toBe(differentKey)
  })
})
