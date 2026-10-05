import { beforeEach, describe, expect, it, vi } from 'vitest'

const transactionMock = vi.fn()
const lockBoutsPageSettingMock = vi.fn()
const lockMatScheduleRuntimeRowsMock = vi.fn()
const loadScheduleSnapshotMock = vi.fn()
const getGroupedBoutsForScheduleMock = vi.fn()
const buildScheduledMatsMock = vi.fn()
const classifyMatExecutionsMock = vi.fn()
const cleanupEmptyExecutionsIfNotStartedMock = vi.fn()
const assertCanStartBoutMock = vi.fn()

vi.mock('../../prisma', () => ({
  prisma: {
    $transaction: transactionMock,
  },
}))

vi.mock('../locks', () => ({
  lockBoutsPageSetting: lockBoutsPageSettingMock,
  lockMatScheduleRuntimeRows: lockMatScheduleRuntimeRowsMock,
}))

vi.mock('../scheduleService', () => ({
  loadScheduleSnapshot: loadScheduleSnapshotMock,
  buildScheduledMats: buildScheduledMatsMock,
}))

vi.mock('../schedulePipeline', () => ({
  getGroupedBoutsForSchedule: getGroupedBoutsForScheduleMock,
  buildScheduleOverridesFromPairs: vi.fn().mockReturnValue({}),
}))

vi.mock('../../brackets/generation/publishedDraws', () => ({
  getActivePublishedGeneration: vi.fn().mockResolvedValue(null),
  getCurrentPublishedDraws: vi.fn().mockResolvedValue([]),
}))

vi.mock('../getMatExecutionState', () => ({
  classifyMatExecutions: classifyMatExecutionsMock,
}))

vi.mock('../executionGuards', () => ({
  cleanupEmptyExecutionsIfNotStarted: cleanupEmptyExecutionsIfNotStartedMock,
}))

vi.mock('../executionValidation', () => ({
  assertCanStartBout: assertCanStartBoutMock,
  assertCanCompleteBout: vi.fn(),
}))

vi.mock('../stageGateValidation', () => ({
  assertStageGateAllowsStart: vi.fn(),
  buildStageGatePlannedContext: vi.fn().mockReturnValue({}),
}))

describe('executionMutations race semantics', () => {
  beforeEach(() => {
    transactionMock.mockReset()
    lockBoutsPageSettingMock.mockReset()
    lockMatScheduleRuntimeRowsMock.mockReset()
    loadScheduleSnapshotMock.mockReset()
    getGroupedBoutsForScheduleMock.mockReset()
    buildScheduledMatsMock.mockReset()
    classifyMatExecutionsMock.mockReset()
    cleanupEmptyExecutionsIfNotStartedMock.mockReset()
    assertCanStartBoutMock.mockReset()

    lockBoutsPageSettingMock.mockResolvedValue({ matCount: 1, scheduleVersion: 0 })
    lockMatScheduleRuntimeRowsMock.mockResolvedValue([])
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
    getGroupedBoutsForScheduleMock.mockResolvedValue({
      mats: [{ matIndex: 1, bouts: [{ id: 'b1', competitionStage: 1, categoryKey: 'cat:a' }] }],
    })
    buildScheduledMatsMock.mockReturnValue({
      mats: [
        {
          matIndex: 1,
          bouts: [
            {
              id: 'b1',
              matchNumber: 1,
              matIndex: 1,
              categoryKey: 'cat:a',
              categoryTitle: 'Cat',
              discipline: 'FS',
              competitionStage: 1,
              schedulePhase: 'elimination',
              sideA: { kind: 'bye' },
              sideB: { kind: 'bye' },
              scheduleDisplayNumber: '1-1',
              schedulePosition: 1,
              matId: 'mat-1',
              matNumber: 1,
              isFrozen: false,
              isInEditableZone: true,
              isNextStartable: true,
              timing: {
                status: 'upcoming',
                estimatedStartAt: '2026-10-03T05:00:00.000Z',
                scheduledStartAt: '2026-10-03T05:00:00.000Z',
                scheduledEndAt: '2026-10-03T05:03:00.000Z',
                estimatedEndAt: '2026-10-03T05:03:00.000Z',
                durationMinutes: 3,
                delayMinutes: 0,
                isDelayed: false,
              },
            },
          ],
        },
      ],
      stageSummaries: [],
    })
    classifyMatExecutionsMock.mockReturnValue({
      completedIds: [],
      inProgressId: null,
      upcomingIds: ['b1'],
    })
    cleanupEmptyExecutionsIfNotStartedMock.mockResolvedValue(0)
    assertCanStartBoutMock.mockImplementation(({ boutId }: { boutId: string }) => ({
      id: boutId,
    }))
  })

  it('START acquires global lock order before runtime row lock', async () => {
    const callOrder: string[] = []
    lockBoutsPageSettingMock.mockImplementation(async () => {
      callOrder.push('settings')
      return { matCount: 1, scheduleVersion: 0 }
    })
    lockMatScheduleRuntimeRowsMock.mockImplementation(async () => {
      callOrder.push('runtime')
    })

    const scheduleMutationCreate = vi.fn().mockResolvedValue({
      mutationId: '11111111-1111-4111-8111-111111111111',
      status: 'PENDING',
      requestFingerprint: 'fp',
      boutId: 'b1',
      command: 'START',
      actorId: null,
      ownerToken: 'owner',
      leaseUntil: new Date(Date.now() + 60_000),
      committedScheduleVersion: null,
      responseJson: null,
      errorJson: null,
    })
    const scheduleMutationUpdate = vi.fn().mockResolvedValue({})
    const boutsPageSettingUpdate = vi.fn().mockResolvedValue({ scheduleVersion: 1 })

    transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        scheduleMutationLog: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: scheduleMutationCreate,
          update: scheduleMutationUpdate,
        },
        boutsPageSetting: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({ scheduleVersion: 0 }),
          update: boutsPageSettingUpdate,
        },
        boutScheduleExecution: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({}),
        },
      }),
    )

    const { startBoutExecution } = await import('../executionMutations')
    await startBoutExecution({
      boutId: 'b1',
      matIndex: 1,
      mutationId: '11111111-1111-4111-8111-111111111111',
      expectedScheduleVersion: 0,
    })

    expect(callOrder).toEqual(['settings', 'runtime'])
  })
})
