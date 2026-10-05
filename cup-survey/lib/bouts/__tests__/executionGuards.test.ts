import { describe, expect, it, vi } from 'vitest'
import {
  assertNoOrphanExecutions,
  cleanupEmptyExecutionsIfNotStarted,
  hasExecutionHistory,
  isEmptyExecution,
  normalizeScheduleExecution,
  tournamentHasStarted,
} from '../executionGuards'

describe('executionGuards orphan invariant', () => {
  it('treats actualEndAt without start as orphan history', () => {
    expect(
      hasExecutionHistory({
        boutId: 'b1',
        actualStartAt: null,
        actualEndAt: new Date(),
      }),
    ).toBe(true)
  })

  it('normalizeScheduleExecution drops end-only rows for schedule reads', () => {
    expect(
      normalizeScheduleExecution({
        boutId: 'b1',
        actualStartAt: null,
        actualEndAt: new Date('2026-01-01T10:00:00.000Z'),
      }),
    ).toEqual({
      boutId: 'b1',
      actualStartAt: null,
      actualEndAt: null,
      frozenScheduleFormatted: null,
      frozenScheduleMatNumber: null,
      frozenSchedulePosition: null,
    })
  })

  it('throws corrupt when end-only execution is missing from schedule', () => {
    expect(() =>
      assertNoOrphanExecutions({
        scheduleBoutIds: [],
        executions: [
          {
            boutId: 'orphan',
            actualStartAt: null,
            actualEndAt: new Date(),
          },
        ],
      }),
    ).toThrow(/STARTED_EXECUTION_ORPHAN|BOUTS_SCHEDULE_CORRUPT/)
  })

  it('detects empty execution rows', () => {
    expect(
      isEmptyExecution({
        boutId: 'b1',
        actualStartAt: null,
        actualEndAt: null,
      }),
    ).toBe(true)
  })

  it('skips cleanup when tournament has started', async () => {
    const deleteMany = vi.fn()
    const tx = { boutScheduleExecution: { deleteMany } }

    const count = await cleanupEmptyExecutionsIfNotStarted(tx as never, [
      { boutId: 'empty', actualStartAt: null, actualEndAt: null },
      {
        boutId: 'started',
        actualStartAt: new Date(),
        actualEndAt: null,
      },
    ])

    expect(count).toBe(0)
    expect(deleteMany).not.toHaveBeenCalled()
    expect(tournamentHasStarted([{ boutId: 'x', actualStartAt: new Date(), actualEndAt: null }])).toBe(
      true,
    )
  })

  it('deletes empty execution rows before first global START', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 })
    const tx = { boutScheduleExecution: { deleteMany } }

    const count = await cleanupEmptyExecutionsIfNotStarted(tx as never, [
      { boutId: 'empty-1', actualStartAt: null, actualEndAt: null },
      { boutId: 'empty-2', actualStartAt: null, actualEndAt: null },
    ])

    expect(count).toBe(2)
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        boutId: { in: ['empty-1', 'empty-2'] },
        actualStartAt: null,
        actualEndAt: null,
      },
    })
  })
})
