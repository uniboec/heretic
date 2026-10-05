import { describe, expect, it, vi, beforeEach } from 'vitest'

const { incrementRevisionMock, autoSyncMock } = vi.hoisted(() => ({
  incrementRevisionMock: vi.fn(async () => BigInt(1)),
  autoSyncMock: vi.fn(),
}))

vi.mock('../prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({})),
  },
}))

vi.mock('../../brackets/core/locks', () => ({
  incrementRegistrationRevision: incrementRevisionMock,
}))

vi.mock('../bracketAutoSync', () => ({
  autoSyncBracketDraftForRegistrationChange: autoSyncMock,
}))

import { withBracketImpactAfterCommit } from '../bracketImpactCoordinator'

describe('bracketImpactCoordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    autoSyncMock.mockResolvedValue(undefined)
  })

  it('runs mutation first, then revision bump and post-commit sync', async () => {
    const result = await withBracketImpactAfterCommit(async () => 'ok')
    expect(result).toBe('ok')
    expect(incrementRevisionMock).toHaveBeenCalledTimes(1)
    expect(autoSyncMock).toHaveBeenCalledTimes(1)
  })

  it('returns mutation result even when post-commit sync fails', async () => {
    autoSyncMock.mockRejectedValueOnce(new Error('sync failed'))
    await expect(withBracketImpactAfterCommit(async () => 42)).resolves.toBe(42)
    expect(incrementRevisionMock).toHaveBeenCalledTimes(1)
  })
})
