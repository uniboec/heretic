import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { assertIntegrationTestDatabase } from '@/lib/db/integrationDatabaseUrl'
import { enqueueAwardCeremony } from '../../enqueue'
import { PlacementNotFoundError, RevisionConflictError } from '../../errors'
import { bulkCompleteCategory, reorderQueueCategory, updatePlacementStatus } from '../../mutations'
import { withAwardOperation } from '../../idempotency'
import { ensureAwardsPageSettings } from '../../settings'

async function resetAwardsTables() {
  await prisma.awardCeremonyPlacement.deleteMany()
  await prisma.awardCeremonyQueue.deleteMany()
  await prisma.awardCeremonyOperation.deleteMany()
  await prisma.awardsPageSetting.updateMany({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    data: { queueRevision: 0, ceremonySequenceCounter: 0 },
  })
}

describe('awards integration', () => {
  beforeEach(async () => {
    assertIntegrationTestDatabase()
    await ensureAwardsPageSettings()
    await resetAwardsTables()
  })

  it('enqueue is idempotent and increments queueRevision once', async () => {
    const input = {
      categoryKey: 'cat-enqueue-a',
      result: {
        status: 'complete' as const,
        placements: [
          { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' as const },
          { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER' as const },
          { entryId: 'e3', placement: 3, reason: 'BRONZE_WINNER' as const },
        ],
      },
      participants: [
        { entryId: 'e1', displayName: 'A A', clubName: 'C1' },
        { entryId: 'e2', displayName: 'B B', clubName: 'C2' },
        { entryId: 'e3', displayName: 'C C', clubName: 'C3' },
      ],
    }

    const first = await prisma.$transaction((tx) => enqueueAwardCeremony(tx, input))
    const second = await prisma.$transaction((tx) => enqueueAwardCeremony(tx, input))
    const settings = await prisma.awardsPageSetting.findUnique({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })
    const row = await prisma.awardCeremonyQueue.findFirst({
      include: { placements: true },
    })

    expect(first).toBe(true)
    expect(second).toBe(false)
    expect(settings?.queueRevision).toBe(1)
    expect(row?.placements).toHaveLength(3)
  })

  it('moveToEnd keeps deferred after new normal enqueue', async () => {
    await prisma.$transaction(async (tx) => {
      await enqueueAwardCeremony(tx, {
        categoryKey: 'cat-a',
        result: { status: 'complete', placements: [{ entryId: 'a1', placement: 1, reason: 'FINAL_WINNER' }] },
        participants: [{ entryId: 'a1', displayName: 'A A', clubName: 'C1' }],
      })
      await enqueueAwardCeremony(tx, {
        categoryKey: 'cat-b',
        result: { status: 'complete', placements: [{ entryId: 'b1', placement: 1, reason: 'FINAL_WINNER' }] },
        participants: [{ entryId: 'b1', displayName: 'B B', clubName: 'C2' }],
      })
      await enqueueAwardCeremony(tx, {
        categoryKey: 'cat-c',
        result: { status: 'complete', placements: [{ entryId: 'c1', placement: 1, reason: 'FINAL_WINNER' }] },
        participants: [{ entryId: 'c1', displayName: 'C C', clubName: 'C3' }],
      })
    })

    const c = await prisma.awardCeremonyQueue.findUnique({
      where: { tournamentScopeId_categoryKey: { tournamentScopeId: TOURNAMENT_SCOPE_ID, categoryKey: 'cat-c' } },
    })
    const settings = await prisma.awardsPageSetting.findUnique({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })
    if (!c || !settings) throw new Error('missing rows')

    await reorderQueueCategory({
      operationId: 'op-move-end',
      queueId: c.id,
      action: 'moveToEnd',
      expectedQueueRevision: settings.queueRevision,
    })

    await prisma.$transaction((tx) =>
      enqueueAwardCeremony(tx, {
        categoryKey: 'cat-d',
        result: { status: 'complete', placements: [{ entryId: 'd1', placement: 1, reason: 'FINAL_WINNER' }] },
        participants: [{ entryId: 'd1', displayName: 'D D', clubName: 'C4' }],
      }),
    )

    const pending = await prisma.awardCeremonyQueue.findMany({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID, status: 'PENDING' },
      orderBy: [{ queueGroup: 'asc' }, { queueOrder: 'asc' }],
    })

    expect(pending.map((row) => row.categoryKey)).toEqual(['cat-a', 'cat-b', 'cat-d', 'cat-c'])
    expect(pending[3]?.queueGroup).toBe('DEFERRED')
  })

  it('replays successful placement mutation with same operationId', async () => {
    await prisma.$transaction((tx) =>
      enqueueAwardCeremony(tx, {
        categoryKey: 'cat-placement',
        result: {
          status: 'complete',
          placements: [
            { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' },
            { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER' },
          ],
        },
        participants: [
          { entryId: 'e1', displayName: 'A A', clubName: 'C1' },
          { entryId: 'e2', displayName: 'B B', clubName: 'C2' },
        ],
      }),
    )

    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-placement' },
      include: { placements: true },
    })
    if (!queue) throw new Error('queue missing')
    const placement = queue.placements[0]
    if (!placement) throw new Error('placement missing')

    const payload = {
      operationId: 'op-replay',
      queueId: queue.id,
      placementId: placement.id,
      expectedRevision: queue.revision,
      status: 'AWARDED' as const,
    }

    const first = await updatePlacementStatus(payload)
    const second = await updatePlacementStatus(payload)

    expect(second).toEqual(first)
    const updated = await prisma.awardCeremonyQueue.findUnique({ where: { id: queue.id } })
    expect(updated?.revision).toBe(queue.revision + 1)
  })

  it('rejects stale revision on new operationId for real mutations', async () => {
    await prisma.$transaction((tx) =>
      enqueueAwardCeremony(tx, {
        categoryKey: 'cat-stale',
        result: {
          status: 'complete',
          placements: [
            { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' },
            { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER' },
          ],
        },
        participants: [
          { entryId: 'e1', displayName: 'A A', clubName: 'C1' },
          { entryId: 'e2', displayName: 'B B', clubName: 'C2' },
        ],
      }),
    )
    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-stale' },
      include: { placements: true },
    })
    if (!queue?.placements[0] || !queue.placements[1]) throw new Error('missing queue')

    await updatePlacementStatus({
      operationId: 'op-1',
      queueId: queue.id,
      placementId: queue.placements[0].id,
      expectedRevision: queue.revision,
      status: 'AWARDED',
    })

    await expect(
      updatePlacementStatus({
        operationId: 'op-2',
        queueId: queue.id,
        placementId: queue.placements[1].id,
        expectedRevision: queue.revision,
        status: 'AWARDED',
      }),
    ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' })
  })

  it('auto-completes with a single revision bump on the last checkmark', async () => {
    await prisma.$transaction((tx) =>
      enqueueAwardCeremony(tx, {
        categoryKey: 'cat-auto',
        result: {
          status: 'complete',
          placements: [
            { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' },
            { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER' },
          ],
        },
        participants: [
          { entryId: 'e1', displayName: 'A A', clubName: 'C1' },
          { entryId: 'e2', displayName: 'B B', clubName: 'C2' },
        ],
      }),
    )

    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-auto' },
      include: { placements: true },
    })
    if (!queue?.placements[0] || !queue.placements[1]) throw new Error('missing queue')

    const settingsAfterEnqueue = await prisma.awardsPageSetting.findUnique({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })
    const queueRevisionAfterEnqueue = settingsAfterEnqueue?.queueRevision ?? 0

    await updatePlacementStatus({
      operationId: 'op-first',
      queueId: queue.id,
      placementId: queue.placements[0].id,
      expectedRevision: queue.revision,
      status: 'AWARDED',
    })

    const inProgress = await prisma.awardCeremonyQueue.findUnique({
      where: { id: queue.id },
      include: { placements: true },
    })
    const pendingPlacement = inProgress?.placements.find((placement) => placement.status === 'PENDING')
    if (!inProgress || !pendingPlacement) throw new Error('missing in-progress queue')

    const result = await updatePlacementStatus({
      operationId: 'op-last',
      queueId: inProgress.id,
      placementId: pendingPlacement.id,
      expectedRevision: inProgress.revision,
      status: 'AWARDED',
    })

    const completed = await prisma.awardCeremonyQueue.findUnique({ where: { id: queue.id } })
    const settings = await prisma.awardsPageSetting.findUnique({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })

    expect(completed?.status).toBe('COMPLETED')
    expect(result.revision).toBe(inProgress.revision + 1)
    expect(settings?.queueRevision).toBe(queueRevisionAfterEnqueue + 2)
  })

  it('bulk complete bumps revision once', async () => {
    await prisma.$transaction((tx) =>
      enqueueAwardCeremony(tx, {
        categoryKey: 'cat-bulk',
        result: {
          status: 'complete',
          placements: [
            { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' },
            { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER' },
          ],
        },
        participants: [
          { entryId: 'e1', displayName: 'A A', clubName: 'C1' },
          { entryId: 'e2', displayName: 'B B', clubName: 'C2' },
        ],
      }),
    )

    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-bulk' },
    })
    if (!queue) throw new Error('missing queue')

    const result = await bulkCompleteCategory({
      operationId: 'op-bulk',
      queueId: queue.id,
      expectedRevision: queue.revision,
    })

    const completed = await prisma.awardCeremonyQueue.findUnique({ where: { id: queue.id } })
    expect(completed?.status).toBe('COMPLETED')
    expect(result.revision).toBe(queue.revision + 1)
  })

  it('bulk completes in-progress category and awards remaining placements', async () => {
    await prisma.$transaction((tx) =>
      enqueueAwardCeremony(tx, {
        categoryKey: 'cat-bulk-in-progress',
        result: {
          status: 'complete',
          placements: [
            { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' },
            { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER' },
          ],
        },
        participants: [
          { entryId: 'e1', displayName: 'A A', clubName: 'C1' },
          { entryId: 'e2', displayName: 'B B', clubName: 'C2' },
        ],
      }),
    )

    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-bulk-in-progress' },
      include: { placements: true },
    })
    if (!queue?.placements[0]) throw new Error('missing queue')

    await updatePlacementStatus({
      operationId: 'op-bulk-in-progress-start',
      queueId: queue.id,
      placementId: queue.placements[0].id,
      expectedRevision: queue.revision,
      status: 'AWARDED',
    })

    const inProgress = await prisma.awardCeremonyQueue.findUnique({
      where: { id: queue.id },
      include: { placements: true },
    })
    if (!inProgress) throw new Error('missing in-progress queue')

    const result = await bulkCompleteCategory({
      operationId: 'op-bulk-in-progress',
      queueId: inProgress.id,
      expectedRevision: inProgress.revision,
    })

    const completed = await prisma.awardCeremonyQueue.findUnique({
      where: { id: queue.id },
      include: { placements: true },
    })
    expect(completed?.status).toBe('COMPLETED')
    expect(completed?.placements.every((placement) => placement.status === 'AWARDED')).toBe(true)
    expect(result.revision).toBe(inProgress.revision + 1)
  })

  it('late award on completed category does not change queueRevision or ceremonyCompletedAt', async () => {
    await prisma.$transaction((tx) =>
      enqueueAwardCeremony(tx, {
        categoryKey: 'cat-late',
        result: {
          status: 'complete',
          placements: [
            { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' },
            { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER' },
          ],
        },
        participants: [
          { entryId: 'e1', displayName: 'A A', clubName: 'C1' },
          { entryId: 'e2', displayName: 'B B', clubName: 'C2' },
        ],
      }),
    )

    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-late' },
      include: { placements: true },
    })
    if (!queue) throw new Error('missing queue')

    await bulkCompleteCategory({
      operationId: 'op-bulk-late',
      queueId: queue.id,
      expectedRevision: queue.revision,
    })

    const completed = await prisma.awardCeremonyQueue.findUnique({
      where: { id: queue.id },
      include: { placements: true },
    })
    if (!completed) throw new Error('missing completed queue')

    const notAwardedPlacement = completed.placements.find((placement) => placement.status === 'AWARDED')
    if (!notAwardedPlacement) throw new Error('missing placement')

    await prisma.awardCeremonyPlacement.update({
      where: { id: notAwardedPlacement.id },
      data: { status: 'NOT_AWARDED', resolvedAt: new Date() },
    })

    const settingsBefore = await prisma.awardsPageSetting.findUnique({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })
    const ceremonyCompletedAt = completed.ceremonyCompletedAt

    const result = await updatePlacementStatus({
      operationId: 'op-late',
      queueId: completed.id,
      placementId: notAwardedPlacement.id,
      expectedRevision: completed.revision,
      status: 'AWARDED',
    })

    const settingsAfter = await prisma.awardsPageSetting.findUnique({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })
    const after = await prisma.awardCeremonyQueue.findUnique({ where: { id: completed.id } })

    expect(result.revision).toBe(completed.revision + 1)
    expect(settingsAfter?.queueRevision).toBe(settingsBefore?.queueRevision)
    expect(after?.ceremonyCompletedAt?.toISOString()).toBe(ceremonyCompletedAt?.toISOString())
  })

  it('completes single-placement category atomically on first AWARDED', async () => {
    await prisma.$transaction((tx) =>
      enqueueAwardCeremony(tx, {
        categoryKey: 'cat-single',
        result: {
          status: 'complete',
          placements: [{ entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' }],
        },
        participants: [{ entryId: 'e1', displayName: 'A A', clubName: 'C1' }],
      }),
    )

    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-single' },
      include: { placements: true },
    })
    if (!queue?.placements[0]) throw new Error('missing queue')

    const settingsBefore = await prisma.awardsPageSetting.findUnique({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })
    const queueRevisionBefore = settingsBefore?.queueRevision ?? 0

    await updatePlacementStatus({
      operationId: 'op-single',
      queueId: queue.id,
      placementId: queue.placements[0].id,
      expectedRevision: queue.revision,
      status: 'AWARDED',
    })

    const completed = await prisma.awardCeremonyQueue.findUnique({ where: { id: queue.id } })
    const settingsAfter = await prisma.awardsPageSetting.findUnique({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })

    expect(completed?.status).toBe('COMPLETED')
    expect(completed?.ceremonyCompletedAt).not.toBeNull()
    expect(completed?.actualStartAt).not.toBeNull()
    expect(completed?.ceremonySequence).toBe(1)
    expect(settingsAfter?.queueRevision).toBe(queueRevisionBefore + 1)
  })

  it('bulk complete from PENDING bumps queueRevision once', async () => {
    await prisma.$transaction((tx) =>
      enqueueAwardCeremony(tx, {
        categoryKey: 'cat-bulk-once',
        result: {
          status: 'complete',
          placements: [
            { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' },
            { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER' },
          ],
        },
        participants: [
          { entryId: 'e1', displayName: 'A A', clubName: 'C1' },
          { entryId: 'e2', displayName: 'B B', clubName: 'C2' },
        ],
      }),
    )

    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-bulk-once' },
    })
    if (!queue) throw new Error('missing queue')

    const settingsBefore = await prisma.awardsPageSetting.findUnique({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })
    const queueRevisionBefore = settingsBefore?.queueRevision ?? 0

    await bulkCompleteCategory({
      operationId: 'op-bulk-once',
      queueId: queue.id,
      expectedRevision: queue.revision,
    })

    const completed = await prisma.awardCeremonyQueue.findUnique({ where: { id: queue.id } })
    const settingsAfter = await prisma.awardsPageSetting.findUnique({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })

    expect(completed?.status).toBe('COMPLETED')
    expect(settingsAfter?.queueRevision).toBe(queueRevisionBefore + 1)
  })

  it('allows same-state no-op with stale expectedRevision', async () => {
    await prisma.$transaction((tx) =>
      enqueueAwardCeremony(tx, {
        categoryKey: 'cat-noop',
        result: {
          status: 'complete',
          placements: [
            { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' },
            { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER' },
          ],
        },
        participants: [
          { entryId: 'e1', displayName: 'A A', clubName: 'C1' },
          { entryId: 'e2', displayName: 'B B', clubName: 'C2' },
        ],
      }),
    )

    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-noop' },
      include: { placements: true },
    })
    if (!queue?.placements[0]) throw new Error('missing queue')

    await updatePlacementStatus({
      operationId: 'op-noop-1',
      queueId: queue.id,
      placementId: queue.placements[0].id,
      expectedRevision: queue.revision,
      status: 'AWARDED',
    })

    const after = await prisma.awardCeremonyQueue.findUnique({
      where: { id: queue.id },
      include: { placements: true },
    })
    if (!after) throw new Error('missing queue')

    const awarded = after.placements.find((placement) => placement.status === 'AWARDED')
    if (!awarded) throw new Error('missing awarded placement')

    const noop = await updatePlacementStatus({
      operationId: 'op-noop-2',
      queueId: after.id,
      placementId: awarded.id,
      expectedRevision: queue.revision,
      status: 'AWARDED',
    })

    expect(noop.revision).toBe(after.revision)
    expect(after.revision).toBe(queue.revision + 1)
  })

  it('rejects placement that does not belong to locked category', async () => {
    await prisma.$transaction(async (tx) => {
      await enqueueAwardCeremony(tx, {
        categoryKey: 'cat-own',
        result: {
          status: 'complete',
          placements: [{ entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' }],
        },
        participants: [{ entryId: 'e1', displayName: 'A A', clubName: 'C1' }],
      })
      await enqueueAwardCeremony(tx, {
        categoryKey: 'cat-other',
        result: {
          status: 'complete',
          placements: [{ entryId: 'e2', placement: 1, reason: 'FINAL_WINNER' }],
        },
        participants: [{ entryId: 'e2', displayName: 'B B', clubName: 'C2' }],
      })
    })

    const own = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-own' },
      include: { placements: true },
    })
    const other = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-other' },
      include: { placements: true },
    })
    if (!own?.placements[0] || !other) throw new Error('missing queue')

    await expect(
      updatePlacementStatus({
        operationId: 'op-foreign',
        queueId: own.id,
        placementId: other.placements[0]!.id,
        expectedRevision: own.revision,
        status: 'AWARDED',
      }),
    ).rejects.toBeInstanceOf(PlacementNotFoundError)
  })

  it('CAS race: second PATCH with stale revision gets 409 then succeeds after retry', async () => {
    await prisma.$transaction((tx) =>
      enqueueAwardCeremony(tx, {
        categoryKey: 'cat-race',
        result: {
          status: 'complete',
          placements: [
            { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' },
            { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER' },
          ],
        },
        participants: [
          { entryId: 'e1', displayName: 'A A', clubName: 'C1' },
          { entryId: 'e2', displayName: 'B B', clubName: 'C2' },
        ],
      }),
    )

    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-race' },
      include: { placements: true },
    })
    if (!queue?.placements[0] || !queue.placements[1]) throw new Error('missing queue')

    const settingsBefore = await prisma.awardsPageSetting.findUnique({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })
    const queueRevisionBefore = settingsBefore?.queueRevision ?? 0
    const initialRevision = queue.revision

    await updatePlacementStatus({
      operationId: 'op-race-1',
      queueId: queue.id,
      placementId: queue.placements[0].id,
      expectedRevision: initialRevision,
      status: 'AWARDED',
    })

    const inProgress = await prisma.awardCeremonyQueue.findUnique({
      where: { id: queue.id },
      include: { placements: true },
    })
    if (!inProgress) throw new Error('missing queue')

    expect(inProgress.status).toBe('IN_PROGRESS')
    expect(inProgress.ceremonyCompletedAt).toBeNull()

    await expect(
      updatePlacementStatus({
        operationId: 'op-race-2-stale',
        queueId: queue.id,
        placementId: queue.placements[1].id,
        expectedRevision: initialRevision,
        status: 'AWARDED',
      }),
    ).rejects.toBeInstanceOf(RevisionConflictError)

    const pendingPlacement = inProgress.placements.find((p) => p.status === 'PENDING')
    if (!pendingPlacement) throw new Error('missing pending placement')

    await updatePlacementStatus({
      operationId: 'op-race-2-retry',
      queueId: inProgress.id,
      placementId: pendingPlacement.id,
      expectedRevision: inProgress.revision,
      status: 'AWARDED',
    })

    const completed = await prisma.awardCeremonyQueue.findUnique({ where: { id: queue.id } })
    const settingsAfter = await prisma.awardsPageSetting.findUnique({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })

    expect(completed?.status).toBe('COMPLETED')
    expect(completed?.ceremonyCompletedAt).not.toBeNull()
    expect(settingsAfter?.queueRevision).toBe(queueRevisionBefore + 2)
  })

  it('reopens COMPLETED category to IN_PROGRESS on undo and keeps ceremonySequence', async () => {
    await prisma.$transaction((tx) =>
      enqueueAwardCeremony(tx, {
        categoryKey: 'cat-reopen',
        result: {
          status: 'complete',
          placements: [
            { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' },
            { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER' },
          ],
        },
        participants: [
          { entryId: 'e1', displayName: 'A A', clubName: 'C1' },
          { entryId: 'e2', displayName: 'B B', clubName: 'C2' },
        ],
      }),
    )

    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-reopen' },
      include: { placements: true },
    })
    if (!queue) throw new Error('missing queue')

    await bulkCompleteCategory({
      operationId: 'op-reopen-bulk',
      queueId: queue.id,
      expectedRevision: queue.revision,
    })

    const completed = await prisma.awardCeremonyQueue.findUnique({
      where: { id: queue.id },
      include: { placements: true },
    })
    if (!completed?.placements[0]) throw new Error('missing completed')

    const ceremonySequence = completed.ceremonySequence
    const actualStartAt = completed.actualStartAt

    await updatePlacementStatus({
      operationId: 'op-reopen-undo',
      queueId: completed.id,
      placementId: completed.placements[0].id,
      expectedRevision: completed.revision,
      status: 'PENDING',
    })

    const reopened = await prisma.awardCeremonyQueue.findUnique({ where: { id: queue.id } })
    expect(reopened?.status).toBe('IN_PROGRESS')
    expect(reopened?.ceremonyCompletedAt).toBeNull()
    expect(reopened?.actualEndAt).toBeNull()
    expect(reopened?.ceremonySequence).toBe(ceremonySequence)
    expect(reopened?.actualStartAt?.toISOString()).toBe(actualStartAt?.toISOString())
  })

  it('keeps category IN_PROGRESS when all placements return to PENDING', async () => {
    await prisma.$transaction((tx) =>
      enqueueAwardCeremony(tx, {
        categoryKey: 'cat-stay-progress',
        result: {
          status: 'complete',
          placements: [
            { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' },
            { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER' },
          ],
        },
        participants: [
          { entryId: 'e1', displayName: 'A A', clubName: 'C1' },
          { entryId: 'e2', displayName: 'B B', clubName: 'C2' },
        ],
      }),
    )

    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-stay-progress' },
      include: { placements: true },
    })
    if (!queue?.placements[0] || !queue.placements[1]) throw new Error('missing queue')

    await updatePlacementStatus({
      operationId: 'op-stay-1',
      queueId: queue.id,
      placementId: queue.placements[0].id,
      expectedRevision: queue.revision,
      status: 'AWARDED',
    })

    const inProgress = await prisma.awardCeremonyQueue.findUnique({
      where: { id: queue.id },
      include: { placements: true },
    })
    if (!inProgress) throw new Error('missing queue')

    const awardedPlacement = inProgress.placements.find((placement) => placement.status === 'AWARDED')
    if (!awardedPlacement) throw new Error('missing awarded placement')

    await updatePlacementStatus({
      operationId: 'op-stay-undo',
      queueId: inProgress.id,
      placementId: awardedPlacement.id,
      expectedRevision: inProgress.revision,
      status: 'PENDING',
    })

    const after = await prisma.awardCeremonyQueue.findUnique({
      where: { id: queue.id },
      include: { placements: true },
    })

    expect(after?.status).toBe('IN_PROGRESS')
    expect(after?.placements.every((p) => p.status === 'PENDING')).toBe(true)
  })

  it('reserves idempotency before revision check and replays response', async () => {
    const response = await prisma.$transaction((tx) =>
      withAwardOperation({
        tx,
        operationId: 'op-reserve',
        requestPayload: { value: 1 },
        run: async () => ({ ok: true }),
      }),
    )
    const replay = await prisma.$transaction((tx) =>
      withAwardOperation({
        tx,
        operationId: 'op-reserve',
        requestPayload: { value: 1 },
        run: async () => ({ ok: false }),
      }),
    )
    expect(replay).toEqual(response)
  })
})
