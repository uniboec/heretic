import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ImpactChangedError } from '../errors'

const {
  acquireLocksMock,
  verifyUnderLockMock,
  forceRebuildMock,
  incrementRevisionMock,
} = vi.hoisted(() => ({
  acquireLocksMock: vi.fn(),
  verifyUnderLockMock: vi.fn(),
  forceRebuildMock: vi.fn(),
  incrementRevisionMock: vi.fn(),
}))

vi.mock('../../prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({})),
  },
}))

vi.mock('../locks', () => ({
  acquireBracketWriteLocks: acquireLocksMock,
}))

vi.mock('../commitImpact', () => ({
  verifyImpactTokenUnderLock: verifyUnderLockMock,
  requiresDestructiveConfirm: vi.fn(() => true),
}))

vi.mock('../forceRebuild', () => ({
  forceRebuildCategories: forceRebuildMock,
}))

vi.mock('../../core/locks', () => ({
  incrementRegistrationRevision: incrementRevisionMock,
}))

vi.mock('../impact', () => ({
  computeImpactForRegistrationMutation: vi.fn(),
}))

vi.mock('../../core/transactionOptions', () => ({
  BRACKET_MUTATION_TX_OPTIONS: {},
}))

import { withBracketImpactAfterCommit } from '../../../registration/bracketImpactCoordinator'

describe('admin atomic registration mutation rollback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    acquireLocksMock.mockResolvedValue({
      generation: { id: 'live-1', version: 1 },
    })
    verifyUnderLockMock.mockRejectedValue(new ImpactChangedError({ affectedCategoryKeys: [], lockLevels: {} }))
    incrementRevisionMock.mockResolvedValue(BigInt(1))
    forceRebuildMock.mockResolvedValue(undefined)
  })

  it('does not bump revision when impact token is stale under lock', async () => {
    const runMutation = vi.fn(async () => ({ ok: true }))

    await expect(
      withBracketImpactAfterCommit(runMutation, {
        impactToken: 'token',
        registrationId: 'reg-1',
        mutationFingerprint: 'fp-1',
      }),
    ).rejects.toBeInstanceOf(ImpactChangedError)

    expect(runMutation).not.toHaveBeenCalled()
    expect(incrementRevisionMock).not.toHaveBeenCalled()
    expect(forceRebuildMock).not.toHaveBeenCalled()
  })
})
