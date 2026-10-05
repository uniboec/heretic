import { describe, expect, it, vi, beforeEach } from 'vitest'
import { eligibleEntry } from './fixtures/eligibleEntry'

vi.mock('../core/eligibility', () => ({
  loadEligibleEntries: vi.fn(),
}))

vi.mock('../../prisma', () => ({
  prisma: {
    bracketPageSetting: {
      findUnique: vi.fn().mockResolvedValue({ includePaid: true, includeUnpaid: false }),
    },
  },
}))

import { loadEligibleEntries } from '../core/eligibility'
import { validateDraftForPublish } from '../generation/publish'
import { computeSourceCompositionFingerprint } from '../core/fingerprint'

const eligible = [
  eligibleEntry({ entryId: 'e1', displayName: 'Athlete' }),
  eligibleEntry({
    entryId: 'e2',
    displayName: 'Athlete 2',
    clubIdentity: 'd::City',
    clubName: 'd',
    publicNumber: 2,
  }),
]

function mockTx(draft: object) {
  return {
    bracketGeneration: {
      findUnique: vi.fn().mockResolvedValue(draft),
    },
    bracketEntryPlacement: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    bracketFormatRule: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'r1',
          minParticipants: 2,
          maxParticipants: 32,
          systemId: 'olympic',
          defaultBronzeMode: 'ONE',
          allowedSystemIds: ['olympic'],
          sortOrder: 1,
          enabled: true,
        },
      ]),
    },
  }
}

describe('validateDraftForPublish', () => {
  beforeEach(() => {
    vi.mocked(loadEligibleEntries).mockResolvedValue(eligible)
  })

  it('returns INVALID_ACTIVE_SYSTEM for ACTIVE category without system', async () => {
    const sourceFingerprint = computeSourceCompositionFingerprint(eligible)
    const errors = await validateDraftForPublish(
      mockTx({
        id: 'd1',
        sourceRevision: BigInt(1),
        sourceFingerprint,
        categories: [
          {
            categoryKey: 'a',
            status: 'ACTIVE',
            autoSystemId: null,
            systemOverride: null,
            autoBronzeMode: null,
            bronzeModeOverride: null,
            systemVersion: null,
            sourceFingerprint: 'fp',
            seedingFingerprint: 'seed-fp',
            participants: [
              { entryId: 'e1', seedPosition: 1 },
              { entryId: 'e2', seedPosition: 2 },
            ],
          },
        ],
      }) as never,
      'd1',
      BigInt(1),
    )
    expect(errors.some((e) => e.code === 'INVALID_ACTIVE_SYSTEM')).toBe(true)
  })

  it('returns DRAFT_STALE when registration revision mismatches', async () => {
    const sourceFingerprint = computeSourceCompositionFingerprint(eligible)
    const errors = await validateDraftForPublish(
      mockTx({
        id: 'd1',
        sourceRevision: BigInt(1),
        sourceFingerprint,
        categories: [],
      }) as never,
      'd1',
      BigInt(2),
    )
    expect(errors.some((e) => e.code === 'DRAFT_STALE')).toBe(true)
  })

  it('returns INVALID_SYSTEM_FOR_N when override not in allowedSystemIds', async () => {
    const sourceFingerprint = computeSourceCompositionFingerprint(eligible)
    const errors = await validateDraftForPublish(
      mockTx({
        id: 'd1',
        sourceRevision: BigInt(1),
        sourceFingerprint,
        categories: [
          {
            categoryKey: 'a',
            status: 'ACTIVE',
            autoSystemId: 'olympic',
            systemOverride: 'round_robin',
            autoBronzeMode: null,
            bronzeModeOverride: null,
            systemVersion: null,
            sourceFingerprint: 'fp',
            seedingFingerprint: 'seed-fp',
            participants: [
              { entryId: 'e1', seedPosition: 1 },
              { entryId: 'e2', seedPosition: 2 },
            ],
          },
        ],
      }) as never,
      'd1',
      BigInt(1),
    )
    expect(errors.some((e) => e.code === 'INVALID_SYSTEM_FOR_N')).toBe(true)
  })
})
