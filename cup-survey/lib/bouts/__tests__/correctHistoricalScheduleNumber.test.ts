import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatScheduleDisplayNumber } from '../scheduleDisplayNumber'
import {
  InvalidScheduleInvariantError,
  ScheduleContiguityConflictError,
  ScheduleNumberConflictError,
} from '../errors'

const transactionMock = vi.fn()
const loadFullScheduleSnapshotMock = vi.fn()
const buildScheduledMatsMock = vi.fn()
const lockBoutsPageSettingMock = vi.fn()
const withScheduleVersionLockMock = vi.fn()

vi.mock('../../prisma', () => ({
  prisma: {
    $transaction: transactionMock,
  },
}))

vi.mock('../locks', () => ({
  lockBoutsPageSetting: lockBoutsPageSettingMock,
}))

vi.mock('../scheduleService', () => ({
  loadFullScheduleSnapshot: loadFullScheduleSnapshotMock,
  buildScheduledMats: buildScheduledMatsMock,
}))

vi.mock('../scheduleVersion', () => ({
  withScheduleVersionLock: withScheduleVersionLockMock,
}))

function scheduledBout(
  id: string,
  matIndex: number,
  position: number,
  frozenLabel: string | null = null,
) {
  return {
    id,
    matIndex,
    matNumber: matIndex,
    schedulePosition: position,
    scheduleDisplayNumber:
      frozenLabel ?? formatScheduleDisplayNumber(matIndex, position, true),
    isFrozen: frozenLabel != null,
  }
}

describe('correctHistoricalScheduleNumber', () => {
  beforeEach(() => {
    transactionMock.mockReset()
    loadFullScheduleSnapshotMock.mockReset()
    buildScheduledMatsMock.mockReset()
    lockBoutsPageSettingMock.mockReset()
    withScheduleVersionLockMock.mockReset()

    transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        boutScheduleExecution: {
          findUnique: vi.fn().mockImplementation(({ where }: { where: { boutId: string } }) => {
            const position = where.boutId.endsWith('bout-3') ? 3 : where.boutId.endsWith('bout-2') ? 2 : 1
            return Promise.resolve({
              boutId: where.boutId,
              frozenScheduleFormatted: `1-${position}`,
              frozenScheduleMatNumber: 1,
              frozenSchedulePosition: position,
            })
          }),
          update: vi.fn(),
        },
      }),
    )
    loadFullScheduleSnapshotMock.mockResolvedValue({
      settings: { matCount: 1, matsEnabled: true, scheduleVersion: 1 },
      executions: [],
      scheduleOverrides: {},
      grouped: { mats: [{ matIndex: 1, bouts: [] }], warnings: [] },
    })
    buildScheduledMatsMock.mockReturnValue({
      mats: [
        {
          matIndex: 1,
          bouts: [
            scheduledBout('cat::bout-1', 1, 1, '1-1'),
            scheduledBout('cat::bout-2', 1, 2, '1-2'),
          ],
        },
      ],
    })
    withScheduleVersionLockMock.mockImplementation(async (_tx, _version, fn) => {
      const outcome = await fn()
      return {
        result: outcome.result,
        scheduleVersion: 2,
        committedScheduleVersion: 2,
      }
    })
  })

  it('formats mat-prefixed numbers when mats are enabled', () => {
    expect(formatScheduleDisplayNumber(2, 5, true)).toBe('2-5')
  })

  it('formats global positions when mats are disabled', () => {
    expect(formatScheduleDisplayNumber(null, 5, false)).toBe('5')
  })

  it('rejects matNumber mismatch with runtime assignment in v1', async () => {
    const { correctHistoricalScheduleNumber } = await import('../correctHistoricalScheduleNumber')

    await expect(
      correctHistoricalScheduleNumber({
        boutId: 'cat::bout-1',
        newMatNumber: 2,
        newPosition: 1,
        reason: 'typo fix',
        expectedScheduleVersion: 1,
      }),
    ).rejects.toBeInstanceOf(InvalidScheduleInvariantError)
  })

  it('rejects occupied target numbers without auto-swap', async () => {
    const { correctHistoricalScheduleNumber } = await import('../correctHistoricalScheduleNumber')

    await expect(
      correctHistoricalScheduleNumber({
        boutId: 'cat::bout-1',
        newMatNumber: 1,
        newPosition: 2,
        reason: 'occupied slot',
        expectedScheduleVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ScheduleNumberConflictError)
  })

  it('rejects corrections that break frozen contiguity', async () => {
    buildScheduledMatsMock.mockReturnValue({
      mats: [
        {
          matIndex: 1,
          bouts: [
            scheduledBout('cat::bout-1', 1, 1, '1-1'),
            scheduledBout('cat::bout-2', 1, 2, '1-2'),
            scheduledBout('cat::bout-3', 1, 3, '1-3'),
          ],
        },
      ],
    })

    const { correctHistoricalScheduleNumber } = await import('../correctHistoricalScheduleNumber')

    await expect(
      correctHistoricalScheduleNumber({
        boutId: 'cat::bout-3',
        newMatNumber: 1,
        newPosition: 6,
        reason: 'creates gap',
        expectedScheduleVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ScheduleContiguityConflictError)
  })

  it('computes formatted number on server for valid correction', async () => {
    const { correctHistoricalScheduleNumber } = await import('../correctHistoricalScheduleNumber')

    const result = await correctHistoricalScheduleNumber({
      boutId: 'cat::bout-1',
      newMatNumber: 1,
      newPosition: 1,
      reason: 'label typo',
      expectedScheduleVersion: 1,
    })

    expect(result.scheduleDisplayNumber).toBe('1-1')
    expect(result.success).toBe(true)
  })
})
