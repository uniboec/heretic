import { beforeEach, describe, expect, it, vi } from 'vitest'
import { previewBoutResultCorrection } from '../applyBoutResultCorrection'

const getCurrentBoutResult = vi.fn()
const getBlockingDownstreamExecutions = vi.fn()

vi.mock('../boutResultQueries', () => ({
  getCurrentBoutResult: (...args: unknown[]) => getCurrentBoutResult(...args),
  getBlockingDownstreamExecutions: (...args: unknown[]) => getBlockingDownstreamExecutions(...args),
  listBoutResultVersions: vi.fn(),
}))

vi.mock('../../prisma', () => ({
  prisma: {},
}))

describe('previewBoutResultCorrection', () => {
  beforeEach(() => {
    getCurrentBoutResult.mockReset()
    getBlockingDownstreamExecutions.mockReset()
  })

  it('returns metadata-only when winner unchanged', async () => {
    getCurrentBoutResult.mockResolvedValue({
      winnerEntryId: 'winner-1',
      loserEntryId: 'winner-2',
    })
    getBlockingDownstreamExecutions.mockResolvedValue([])

    const preview = await previewBoutResultCorrection({
      boutId: 'bout-1',
      newWinnerEntryId: 'winner-1',
      systemId: 'olympic',
      categoryKey: 'cat-1',
      downstreamBoutIds: ['bout-2'],
    })

    expect(preview.correctionMode).toBe('METADATA_ONLY')
    expect(preview.blocked).toBe(false)
  })

  it('blocks branch recovery when downstream bout is live', async () => {
    getCurrentBoutResult.mockResolvedValue({
      winnerEntryId: 'winner-1',
      loserEntryId: 'winner-2',
    })
    getBlockingDownstreamExecutions.mockResolvedValue([{ boutId: 'bout-2', boutPhase: 'live' }])

    const preview = await previewBoutResultCorrection({
      boutId: 'bout-1',
      newWinnerEntryId: 'winner-2',
      systemId: 'olympic',
      categoryKey: 'cat-1',
      downstreamBoutIds: ['bout-2', 'bout-3'],
    })

    expect(preview.correctionMode).toBe('BRANCH_RECOVERY')
    expect(preview.blocked).toBe(true)
    expect(preview.blockingBoutIds).toEqual(['bout-2'])
  })
})
