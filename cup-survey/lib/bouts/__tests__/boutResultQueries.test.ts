import { describe, expect, it, vi } from 'vitest'
import {
  getCurrentBoutResult,
  invalidateAthleteRestForBouts,
  listActiveBoutResultsForBoutIds,
} from '../boutResultQueries'

describe('boutResultQueries', () => {
  it('invalidates active rest rows for source bouts', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 })
    const tx = { athleteRestState: { updateMany } }

    await invalidateAthleteRestForBouts(tx as never, ['bout-1', 'bout-2'])

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        sourceBoutId: { in: ['bout-1', 'bout-2'] },
        invalidatedAt: null,
      },
      data: { invalidatedAt: expect.any(Date) },
    })
  })

  it('skips update when bout list is empty', async () => {
    const updateMany = vi.fn()
    const tx = { athleteRestState: { updateMany } }

    await invalidateAthleteRestForBouts(tx as never, [])

    expect(updateMany).not.toHaveBeenCalled()
  })

  it('getCurrentBoutResult filters to active current rows only', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 'active',
      boutId: 'cat::bout-1',
      resultStatus: 'ACTIVE',
      isCurrent: true,
    })
    const tx = { boutResult: { findFirst } }

    const result = await getCurrentBoutResult(tx as never, 'cat::bout-1')

    expect(result?.id).toBe('active')
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        boutId: 'cat::bout-1',
        isCurrent: true,
        resultStatus: 'ACTIVE',
      },
    })
  })

  it('listActiveBoutResultsForBoutIds ignores superseded versions', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 'active', boutId: 'cat::bout-1', resultStatus: 'ACTIVE', isCurrent: true },
    ])
    const tx = { boutResult: { findMany } }

    const results = await listActiveBoutResultsForBoutIds(tx as never, ['cat::bout-1'])

    expect(results).toHaveLength(1)
    expect(findMany).toHaveBeenCalledWith({
      where: {
        boutId: { in: ['cat::bout-1'] },
        isCurrent: true,
        resultStatus: 'ACTIVE',
      },
    })
  })
})
