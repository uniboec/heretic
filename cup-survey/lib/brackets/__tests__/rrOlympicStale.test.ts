import { describe, expect, it } from 'vitest'
import { computeDraftDiff } from '../core/diff'
import {
  buildSeedingSnapshot,
  categoryFingerprintForDraw,
  computeSeedingFingerprint,
  computeSourceCompositionFingerprint,
} from '../core/fingerprint'
import { eligibleEntry } from './fixtures/eligibleEntry'
import '../systems'

const eligible = [
  eligibleEntry({ entryId: 'e1', displayName: 'A', clubName: 'c1', clubIdentity: 'c1::City' }),
  eligibleEntry({
    entryId: 'e2',
    displayName: 'B',
    clubName: 'c2',
    clubIdentity: 'c2::City',
    publicNumber: 2,
  }),
]

describe('RR to Olympic seeding stale', () => {
  it('marks seeding stale after system switch from round_robin to olympic', () => {
    const rrSnapshot = buildSeedingSnapshot('round_robin', 1, [
      { entryId: 'e1', clubIdentity: 'c1::City', seedPosition: 1 },
      { entryId: 'e2', clubIdentity: 'c2::City', seedPosition: 2 },
    ])
    const seedingFingerprint = computeSeedingFingerprint(rrSnapshot)
    const fp = categoryFingerprintForDraw('a', ['e1', 'e2'])
    const sourceFp = computeSourceCompositionFingerprint(eligible)

    const diff = computeDraftDiff(
      eligible,
      BigInt(1),
      sourceFp,
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
              clubIdentity: 'c1::City',
              strengthTier: null,
              clubKey: null,
              cityKey: null,
              seedLocked: false,
            },
            {
              entryId: 'e2',
              displayName: 'B',
              seedPosition: 2,
              clubIdentity: 'c2::City',
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

    expect(diff.categories.a?.seedingStale).toBe(true)
  })
})
