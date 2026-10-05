import { describe, expect, it } from 'vitest'
import { computeDraftDiff } from '../core/diff'
import {
  buildSeedingSnapshot,
  categoryFingerprintForDraw,
  computeSeedingFingerprint,
  computeSourceCompositionFingerprint,
} from '../core/fingerprint'
import { eligibleEntry } from './fixtures/eligibleEntry'

const eligible = [
  eligibleEntry({ entryId: 'e1', displayName: 'A' }),
  eligibleEntry({
    entryId: 'e2',
    displayName: 'B',
    clubIdentity: 'd::City',
    clubName: 'd',
    publicNumber: 2,
  }),
]

describe('seeding stale rules', () => {
  it('lock/unlock does not make seeding stale when positions unchanged', () => {
    const snapshot = buildSeedingSnapshot('olympic', 1, [
      { entryId: 'e1', clubIdentity: 'c::City', seedPosition: 1 },
      { entryId: 'e2', clubIdentity: 'd::City', seedPosition: 2 },
    ])
    const seedingFingerprint = computeSeedingFingerprint(snapshot)
    const fp = categoryFingerprintForDraw('a', ['e1', 'e2'])

    const diff = computeDraftDiff(
      eligible,
      BigInt(1),
      computeSourceCompositionFingerprint(eligible),
      BigInt(1),
      [
        {
          categoryKey: 'a',
          sourceFingerprint: fp,
          seedingFingerprint,
          drawInputFingerprint: null,
          drawPolicyId: null,
          drawPolicyVersion: null,
          autoSystemId: 'olympic',
          systemOverride: null,
          systemVersion: null,
          participants: [
            {
              entryId: 'e1',
              displayName: 'A',
              seedPosition: 1,
              clubIdentity: 'c::City',
              strengthTier: null,
              clubKey: null,
              cityKey: null,
              seedLocked: false,
            },
            {
              entryId: 'e2',
              displayName: 'B',
              seedPosition: 2,
              clubIdentity: 'd::City',
              strengthTier: null,
              clubKey: null,
              cityKey: null,
              seedLocked: false,
            },
          ],
        },
      ],
      new Map(),
    )

    expect(diff.categories.a?.seedingStale).toBe(false)
  })
})
