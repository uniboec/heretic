import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompetitionStageChangeForbiddenError } from '../errors'
import { DraftConflictError } from '../../brackets/core/errors'

const transactionMock = vi.fn()
const acquireBracketWriteLocksMock = vi.fn()
const buildScheduledMatsMock = vi.fn()
const getGroupedBoutsForScheduleMock = vi.fn()
const loadScheduleSnapshotMock = vi.fn()
const clearManualOrderForCategoryStageChangeMock = vi.fn()

const drawFindUniqueMock = vi.fn()
const drawUpdateMock = vi.fn()
const generationUpdateMock = vi.fn()
const executeRawMock = vi.fn()

vi.mock('../../prisma', () => ({
  prisma: {
    $transaction: transactionMock,
  },
}))

vi.mock('../../brackets/live/locks', () => ({
  acquireBracketWriteLocks: acquireBracketWriteLocksMock,
}))

vi.mock('../scheduleService', () => ({
  loadScheduleSnapshot: loadScheduleSnapshotMock,
  buildScheduledMats: buildScheduledMatsMock,
}))

vi.mock('../schedulePipeline', () => ({
  getGroupedBoutsForSchedule: getGroupedBoutsForScheduleMock,
}))

vi.mock('../manualOrderCleanup', () => ({
  clearManualOrderForCategoryStageChange: clearManualOrderForCategoryStageChangeMock,
}))

function makeTx(scheduleVersion = 1) {
  const settingsRow = {
    id: 'default',
    scheduleVersion,
    matsEnabled: true,
    scheduleLegacyGap: false,
    matCount: 1,
  }
  const settingsUpdateMock = vi.fn().mockImplementation(async ({ data }: { data: { scheduleVersion?: { increment: number } } }) => ({
    ...settingsRow,
    scheduleVersion: data.scheduleVersion?.increment
      ? settingsRow.scheduleVersion + data.scheduleVersion.increment
      : settingsRow.scheduleVersion,
  }))
  return {
    $executeRaw: executeRawMock,
    bracketCategoryDraw: {
      findUnique: drawFindUniqueMock,
      update: drawUpdateMock,
    },
    bracketGeneration: {
      update: generationUpdateMock,
    },
    boutsPageSetting: {
      findUnique: vi.fn().mockResolvedValue(settingsRow),
      findUniqueOrThrow: vi.fn().mockResolvedValue(settingsRow),
      update: settingsUpdateMock,
    },
  }
}

describe('updateBracketDrawCompetitionStage', () => {
  beforeEach(() => {
    transactionMock.mockReset()
    acquireBracketWriteLocksMock.mockReset()
    buildScheduledMatsMock.mockReset()
    getGroupedBoutsForScheduleMock.mockReset()
    loadScheduleSnapshotMock.mockReset()
    clearManualOrderForCategoryStageChangeMock.mockReset()
    drawFindUniqueMock.mockReset()
    drawUpdateMock.mockReset()
    generationUpdateMock.mockReset()
    executeRawMock.mockReset()

    transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(makeTx()))
    acquireBracketWriteLocksMock.mockResolvedValue({
      generation: { id: 'draft-1', version: 3 },
      boutsSettings: { matCount: 1 },
    })
    drawFindUniqueMock.mockResolvedValue({
      id: 'draw-1',
      generationId: 'draft-1',
      categoryKey: 'cat:a',
      competitionStage: 2,
    })
    getGroupedBoutsForScheduleMock.mockResolvedValue({
      mats: [
        {
          matIndex: 1,
          bouts: [{ id: 'cat:a::1', categoryKey: 'cat:a', competitionStage: 2 }],
        },
      ],
    })
    loadScheduleSnapshotMock.mockResolvedValue({
      settings: {
        matCount: 1,
        competitionStageSettings: { breaksAfterStageMinutes: {}, notBeforeStartTimes: {} },
        boutsStartTime: '10:00',
        boutBreakMinutes: 3,
      },
      executions: [],
      scheduleOverrides: {},
    })
    buildScheduledMatsMock.mockReturnValue({
      mats: [
        {
          matIndex: 1,
          bouts: [{ id: 'cat:a::1', categoryKey: 'cat:a', competitionStage: 2 }],
        },
      ],
      stageSummaries: [],
    })
    drawUpdateMock.mockResolvedValue({})
    generationUpdateMock.mockResolvedValue({})
    clearManualOrderForCategoryStageChangeMock.mockResolvedValue(undefined)
  })

  it('returns no-op when target stage equals current stage', async () => {
    const { updateBracketDrawCompetitionStage } = await import('../mutations')
    const result = await updateBracketDrawCompetitionStage({
      drawId: 'draw-1',
      draftId: 'draft-1',
      expectedVersion: 3,
      competitionStage: 2,
    })

    expect(result).toEqual({
      ok: true,
      draw: { id: 'draw-1', competitionStage: 2 },
      draft: { id: 'draft-1', version: 3 },
    })
    expect(drawUpdateMock).not.toHaveBeenCalled()
    expect(clearManualOrderForCategoryStageChangeMock).not.toHaveBeenCalled()
  })

  it('allows upcoming category to move 2→3', async () => {
    const { updateBracketDrawCompetitionStage } = await import('../mutations')
    const result = await updateBracketDrawCompetitionStage({
      drawId: 'draw-1',
      draftId: 'draft-1',
      expectedVersion: 3,
      expectedScheduleVersion: 1,
      competitionStage: 3,
    })

    expect(result.draw.competitionStage).toBe(3)
    expect(drawUpdateMock).toHaveBeenCalledWith({
      where: { id: 'draw-1' },
      data: { competitionStage: 3 },
    })
    expect(clearManualOrderForCategoryStageChangeMock).toHaveBeenCalledWith(expect.anything(), {
      categoryKey: 'cat:a',
      oldStage: 2,
      newStage: 3,
      matIndex: 1,
    })
  })

  it('rejects 3→1 when target stage already started elsewhere', async () => {
    drawFindUniqueMock.mockResolvedValue({
      id: 'draw-1',
      generationId: 'draft-1',
      categoryKey: 'cat:b',
      competitionStage: 3,
    })
    getGroupedBoutsForScheduleMock.mockResolvedValue({
      mats: [
        {
          matIndex: 1,
          bouts: [
            { id: 'cat:b::1', categoryKey: 'cat:b', competitionStage: 3 },
            { id: 'cat:c::1', categoryKey: 'cat:c', competitionStage: 1 },
          ],
        },
      ],
    })
    buildScheduledMatsMock.mockReturnValue({
      mats: [
        {
          matIndex: 1,
          bouts: [
            { id: 'cat:b::1', categoryKey: 'cat:b', competitionStage: 3 },
            { id: 'cat:c::1', categoryKey: 'cat:c', competitionStage: 1 },
          ],
        },
      ],
      stageSummaries: [],
    })
    loadScheduleSnapshotMock.mockResolvedValue({
      settings: {
        matCount: 1,
        competitionStageSettings: { breaksAfterStageMinutes: {}, notBeforeStartTimes: {} },
        boutsStartTime: '10:00',
        boutBreakMinutes: 3,
      },
      executions: [
        {
          boutId: 'cat:c::1',
          actualStartAt: new Date('2026-10-03T05:00:00.000Z'),
          actualEndAt: null,
        },
      ],
      scheduleOverrides: {},
    })

    const { updateBracketDrawCompetitionStage } = await import('../mutations')
    await expect(
      updateBracketDrawCompetitionStage({
        drawId: 'draw-1',
        draftId: 'draft-1',
        expectedVersion: 3,
        competitionStage: 1,
      }),
    ).rejects.toBeInstanceOf(CompetitionStageChangeForbiddenError)
  })

  it('throws DraftConflictError when draft version mismatches', async () => {
    acquireBracketWriteLocksMock.mockResolvedValue({
      generation: { id: 'draft-1', version: 99 },
      boutsSettings: { matCount: 1 },
    })

    const { updateBracketDrawCompetitionStage } = await import('../mutations')
    await expect(
      updateBracketDrawCompetitionStage({
        drawId: 'draw-1',
        draftId: 'draft-1',
        expectedVersion: 3,
        competitionStage: 3,
      }),
    ).rejects.toBeInstanceOf(DraftConflictError)
  })

  it('serializes through acquireBracketWriteLocks (same prefix as startBout settings lock)', async () => {
    const { updateBracketDrawCompetitionStage } = await import('../mutations')
    await updateBracketDrawCompetitionStage({
      drawId: 'draw-1',
      draftId: 'draft-1',
      expectedVersion: 3,
      expectedScheduleVersion: 1,
      competitionStage: 3,
    })

    expect(acquireBracketWriteLocksMock).toHaveBeenCalledWith(expect.anything(), {
      scope: 'minimal',
      categoryKeys: undefined,
    })
  })
})
