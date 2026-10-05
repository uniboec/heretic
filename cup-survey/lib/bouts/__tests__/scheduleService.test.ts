import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeBoutsPageSettings } from '../normalizeBoutsPageSettings'
import { BoutsScheduleCorruptError } from '../errors'
import { makeTestBout } from './testBoutHelpers'

const transactionMock = vi.fn()
const getGroupedBoutsForScheduleMock = vi.fn()
const getActivePublishedGenerationMock = vi.fn()

vi.mock('../../prisma', () => ({
  prisma: {
    $transaction: transactionMock,
  },
}))

vi.mock('../schedulePipeline', () => ({
  getGroupedBoutsForSchedule: getGroupedBoutsForScheduleMock,
}))

vi.mock('../../brackets/generation/publishedDraws', () => ({
  getActivePublishedGeneration: getActivePublishedGenerationMock,
}))

function makeTx() {
  return {
    boutsPageSetting: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'default',
        publicEnabled: true,
        matCount: 1,
        autoMatAssignMode: 'BY_CATEGORY',
        autoMatByCategoryEnabled: true,
        boutsStartTime: '10:00',
        matStartTimeOverrides: null,
        boutBreakMinutes: 3,
        ageDivisionDurationOverrides: null,
      }),
    },
    boutScheduleExecution: { findMany: vi.fn().mockResolvedValue([]) },
    matScheduleRuntime: { findMany: vi.fn().mockResolvedValue([]) },
  }
}

describe('scheduleService GET snapshot M8', () => {
  beforeEach(() => {
    transactionMock.mockReset()
    getGroupedBoutsForScheduleMock.mockReset()
    getActivePublishedGenerationMock.mockReset()
    getGroupedBoutsForScheduleMock.mockResolvedValue({ mats: [], warnings: [] })
    getActivePublishedGenerationMock.mockResolvedValue(null)
    transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(makeTx()))
  })

  it('uses RepeatableRead isolation for readScheduleSnapshot', async () => {
    const { readScheduleSnapshot } = await import('../scheduleService')
    await readScheduleSnapshot()

    expect(transactionMock).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 15_000,
      timeout: 30_000,
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    })
  })

  it('loads assignments in the same RR transaction for readFullScheduleSnapshot', async () => {
    const { readFullScheduleSnapshot } = await import('../scheduleService')
    await readFullScheduleSnapshot({ adminPreview: true })

    expect(transactionMock).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 15_000,
      timeout: 30_000,
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    })
    expect(getActivePublishedGenerationMock).toHaveBeenCalledTimes(1)
    expect(getGroupedBoutsForScheduleMock).not.toHaveBeenCalled()
  })

  it('loads grouped bouts inside snapshot tx when published generation exists', async () => {
    getActivePublishedGenerationMock.mockResolvedValue({
      id: 'pub-1',
      publishedAt: new Date('2026-10-03T05:00:00.000Z'),
    })

    const { readFullScheduleSnapshot } = await import('../scheduleService')
    const snapshot = await readFullScheduleSnapshot({ adminPreview: false })

    expect(getGroupedBoutsForScheduleMock).toHaveBeenCalledWith(
      expect.anything(),
      1,
      { adminPreview: false },
    )
    expect(snapshot.grouped).toEqual({ mats: [], warnings: [] })
    expect(snapshot.published?.id).toBe('pub-1')
  })

  it('fail-closed GET throws corrupt on orphan execution history', async () => {
    const { buildScheduledMatsOrThrow } = await import('../scheduleService')
    const settings = normalizeBoutsPageSettings({
      publicEnabled: true,
      matCount: 1,
      autoMatAssignMode: 'BY_CATEGORY',
      autoMatByCategoryEnabled: true,
      boutsStartTime: '10:00',
      matStartTimeOverrides: {},
      boutBreakMinutes: 3,
      ageDivisionDurationOverrides: {},
    })
    const bout = makeTestBout({
      id: 'b1',
      categoryKey: 'tactic_control:novice:m_boys_1:w1',
      categoryTitle: 'Test',
      storedMatIndex: 1,
    })

    expect(() =>
      buildScheduledMatsOrThrow({
        grouped: { mats: [{ matIndex: 1, bouts: [bout] }], warnings: [] },
        snapshot: {
          settings,
          executions: [
            {
              boutId: 'orphan',
              actualStartAt: new Date('2026-10-03T05:00:00.000Z'),
              actualEndAt: null,
            },
          ],
        },
        now: new Date('2026-10-03T05:00:00.000Z'),
      }),
    ).toThrow(BoutsScheduleCorruptError)
  })
})
