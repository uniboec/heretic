import { describe, expect, it } from 'vitest'
import '../systems'
import { computeDraftDiff } from '../core/diff'
import {
  buildDrawInputSnapshot,
  buildSeedingSnapshot,
  computeDrawInputFingerprint,
  computeSeedingFingerprint,
} from '../core/fingerprint'
import { getDefaultDrawPolicy } from '../core/seeding/drawPolicy'
import { eligibleEntry } from './fixtures/eligibleEntry'

const eligible = [eligibleEntry({ entryId: 'e1', displayName: 'A' })]

describe('computeDraftDiff', () => {
  it('detects eligibility criteria stale without registration revision change', () => {
    const diff = computeDraftDiff(
      eligible,
      BigInt(5),
      'old-fingerprint',
      BigInt(5),
      [],
      new Map(),
    )
    expect(diff.registrationDataStale).toBe(false)
    expect(diff.eligibilityCriteriaStale).toBe(true)
    expect(diff.globalCompositionStale).toBe(true)
  })

  it('detects registration data stale on revision mismatch', () => {
    const diff = computeDraftDiff(eligible, BigInt(5), 'fp', BigInt(6), [], new Map())
    expect(diff.registrationDataStale).toBe(true)
  })

  it('excludes manual moves from moved diff', () => {
    const fp = 'same-fp'
    const placements = new Map([['e1', { categoryKey: 'b', isManualMove: true }]])
    const diff = computeDraftDiff(
      [
        {
          ...eligible[0],
          effectiveCategoryKey: 'b',
        },
      ],
      BigInt(5),
      fp,
      BigInt(5),
      [
        {
          categoryKey: 'a',
          sourceFingerprint: fp,
          seedingFingerprint: null,
          drawInputFingerprint: null,
          drawPolicyId: null,
          drawPolicyVersion: null,
          autoSystemId: 'olympic',
          systemOverride: null,
          systemVersion: 1,
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
          ],
        },
      ],
      placements,
    )
    expect(diff.categories.a?.moved).toEqual([])
  })

  it('marks balanceStale when registration club/city changes after draw', () => {
    const policy = getDefaultDrawPolicy()
    const storedParticipants = [
      {
        entryId: 'e1',
        displayName: 'A',
        seedPosition: 1,
        clubIdentity: 'club-a::City',
        strengthTier: 5,
        clubKey: 'club-a',
        cityKey: 'city-a',
        seedLocked: false,
      },
      {
        entryId: 'e2',
        displayName: 'B',
        seedPosition: 2,
        clubIdentity: 'club-b::City',
        strengthTier: 4,
        clubKey: 'club-b',
        cityKey: 'city-b',
        seedLocked: false,
      },
    ]
    const currentParticipants = [
      { ...storedParticipants[0], clubKey: 'club-a-changed', cityKey: 'city-a-changed' },
      storedParticipants[1],
    ]
    const seedingSnapshot = buildSeedingSnapshot('olympic', 1, storedParticipants)
    const drawInputSnapshot = buildDrawInputSnapshot(
      policy.drawPolicyId,
      policy.drawPolicyVersion,
      'olympic',
      1,
      storedParticipants,
    )

    const diff = computeDraftDiff(
      [
        eligibleEntry({
          entryId: 'e1',
          displayName: 'A',
          clubKey: 'club-a-changed',
          cityKey: 'city-a-changed',
          strengthTier: 5,
        }),
        eligibleEntry({
          entryId: 'e2',
          displayName: 'B',
          clubKey: 'club-b',
          cityKey: 'city-b',
          strengthTier: 4,
        }),
      ],
      BigInt(5),
      'fp',
      BigInt(5),
      [
        {
          categoryKey: 'cat-a',
          sourceFingerprint: 'fp',
          seedingFingerprint: computeSeedingFingerprint(seedingSnapshot),
          drawInputFingerprint: computeDrawInputFingerprint(drawInputSnapshot),
          drawPolicyId: policy.drawPolicyId,
          drawPolicyVersion: policy.drawPolicyVersion,
          autoSystemId: 'olympic',
          systemOverride: null,
          systemVersion: 1,
          participants: currentParticipants,
        },
      ],
      new Map(),
    )

    expect(diff.categories['cat-a']?.balanceStale).toBe(true)
    expect(diff.categories['cat-a']?.seedingStale).toBe(false)
  })
})
