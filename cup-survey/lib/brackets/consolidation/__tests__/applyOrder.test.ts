import { describe, expect, it, vi } from 'vitest'
import { hashPlan } from '../planFingerprint'
import { hashPolicy } from '../policyHash'
import { legacyPolicy, legacyStep } from './fixtures'

const { calls, mockTx, upsertMock, auditCreateMock, forceRebuildMock } = vi.hoisted(() => {
  const calls: string[] = []
  const upsertMock = vi.fn(async () => {
    calls.push('placementUpsert')
  })
  const auditCreateMock = vi.fn(async () => {
    calls.push('auditCreate')
  })
  const forceRebuildMock = vi.fn(async () => {
    calls.push('forceRebuild')
  })
  const mockTx = {
    bracketPageSetting: {
      findUnique: vi.fn().mockResolvedValue({ includePaid: true, includeUnpaid: false }),
    },
    bracketEntryPlacement: { upsert: upsertMock },
    bracketMoveAudit: { create: auditCreateMock },
    bracketGeneration: {
      update: vi.fn().mockResolvedValue({ id: 'gen-1', version: 2 }),
    },
  }
  return { calls, mockTx, upsertMock, auditCreateMock, forceRebuildMock }
})

const policy = legacyPolicy({
  steps: [legacyStep('WEIGHT_UP')],
})

const plan = {
  finalPlacements: [{ entryId: 'e1', fromCategoryKey: 'cat:a', finalCategoryKey: 'cat:b' }],
  trace: [
    {
      hopIndex: 0,
      stepIndex: 0,
      entryIds: ['e1'],
      fromCategoryKey: 'cat:a',
      toCategoryKey: 'cat:b',
      actions: [{ type: 'WEIGHT_UP' as const }],
      step: 'WEIGHT_UP' as const,
    },
  ],
  skipped: [],
  affectedCategoryKeys: ['cat:a', 'cat:b'],
}

vi.mock('../../../prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: typeof mockTx) => Promise<unknown>) =>
      callback(mockTx),
    ),
  },
}))

vi.mock('../../live/forceRebuild', () => ({
  forceRebuildCategories: forceRebuildMock,
}))

vi.mock('../context', () => ({
  computeConsolidationPlan: vi.fn().mockResolvedValue({ policy, plan }),
}))

vi.mock('../planToken', () => ({
  verifyConsolidationPlanToken: vi.fn().mockReturnValue({
    version: 1,
    generationId: 'gen-1',
    generationVersion: 1,
    policyHash: hashPolicy(policy),
    planFingerprint: hashPlan(plan),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  }),
  assertPlanTokenMatches: vi.fn(),
}))

vi.mock('../../live/impact', () => ({
  computeImpactForConsolidation: vi.fn().mockResolvedValue({
    affectedCategoryKeys: ['cat:a', 'cat:b'],
    lockLevels: { 'cat:a': 'OPEN', 'cat:b': 'OPEN' },
    liveGenerationId: 'gen-1',
    liveGenerationVersion: 1,
    mutationFingerprint: 'fp',
  }),
}))

vi.mock('../../live/locks', () => ({
  acquireBracketWriteLocks: vi.fn().mockResolvedValue({
    generation: { id: 'gen-1', version: 1 },
  }),
}))

describe('applyConsolidation transaction order', () => {
  it('writes placements and audit before forceRebuildCategories', async () => {
    const { applyConsolidation } = await import('../apply')

    await applyConsolidation({
      expectedVersion: 1,
      policy,
      consolidationPlanToken: 'token',
    })

    expect(calls.indexOf('placementUpsert')).toBeLessThan(calls.indexOf('forceRebuild'))
    expect(calls.indexOf('auditCreate')).toBeLessThan(calls.indexOf('forceRebuild'))
    expect(forceRebuildMock).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        generationId: 'gen-1',
        categoryKeys: ['cat:a', 'cat:b'],
        preserveVisible: true,
      }),
    )
  })
})
