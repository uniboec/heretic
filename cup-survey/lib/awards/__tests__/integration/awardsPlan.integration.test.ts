import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { assertIntegrationTestDatabase } from '@/lib/db/integrationDatabaseUrl'
import { enqueueAwardCeremony, resumeOrEnqueueAwardCeremony } from '../../enqueue'
import {
  bulkCompleteCategory,
  reorderQueueCategory,
  updatePlacementStatus,
} from '../../mutations'
import { withAwardOperation } from '../../idempotency'
import { ensureAwardsPageSettings } from '../../settings'
import { syncAwardCeremonyOnCorrection } from '../../syncOnCorrection'
import { getAdminAwardsDashboard, getPublicAwards } from '../../service'

async function resetAwardsTables() {
  await prisma.awardCeremonyPlacement.deleteMany()
  await prisma.awardCeremonyQueue.deleteMany()
  await prisma.awardCeremonyOperation.deleteMany()
  await prisma.awardsPageSetting.updateMany({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    data: { queueRevision: 0, ceremonySequenceCounter: 0, publicEnabled: false },
  })
}

function championInput(categoryKey: string, entryId: string) {
  return {
    categoryKey,
    result: {
      status: 'complete' as const,
      placements: [{ entryId, placement: 1, reason: 'FINAL_WINNER' as const }],
    },
    participants: [{ entryId, displayName: 'A A', clubName: 'C1' }],
  }
}

function duoInput(categoryKey: string) {
  return {
    categoryKey,
    result: {
      status: 'complete' as const,
      placements: [
        { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' as const },
        { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER' as const },
      ],
    },
    participants: [
      { entryId: 'e1', displayName: 'A A', clubName: 'C1' },
      { entryId: 'e2', displayName: 'B B', clubName: 'C2' },
    ],
  }
}

function olympicTwoInput(categoryKey: string) {
  return {
    categoryKey,
    result: {
      status: 'complete' as const,
      placements: [
        { entryId: 'gold', placement: 1, reason: 'FINAL_WINNER' as const },
        { entryId: 'silver', placement: 2, reason: 'FINAL_LOSER' as const },
        { entryId: 'bronze-a', placement: 3, reason: 'BRONZE_TWO' as const },
        { entryId: 'bronze-b', placement: 3, reason: 'BRONZE_TWO' as const },
      ],
    },
    participants: [
      { entryId: 'gold', displayName: 'Gold G', clubName: 'C1' },
      { entryId: 'silver', displayName: 'Silver S', clubName: 'C2' },
      { entryId: 'bronze-a', displayName: 'Bronze A', clubName: 'C3' },
      { entryId: 'bronze-b', displayName: 'Bronze B', clubName: 'C4' },
    ],
  }
}

describe('awards plan integration', () => {
  beforeEach(async () => {
    assertIntegrationTestDatabase()
    await ensureAwardsPageSettings()
    await resetAwardsTables()
  })

  it('assigns distinct queueOrder under concurrent enqueue', async () => {
    const results = await Promise.all([
      prisma.$transaction((tx) => enqueueAwardCeremony(tx, championInput('cat-p1', 'e1'))),
      prisma.$transaction((tx) => enqueueAwardCeremony(tx, championInput('cat-p2', 'e2'))),
      prisma.$transaction((tx) => enqueueAwardCeremony(tx, championInput('cat-p3', 'e3'))),
    ])

    const rows = await prisma.awardCeremonyQueue.findMany({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
      orderBy: { queueOrder: 'asc' },
    })

    expect(results).toEqual([true, true, true])
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.queueOrder)).toEqual([0, 1, 2])
  })

  it('rejects stale reorder after enqueue bumps queueRevision', async () => {
    await prisma.$transaction((tx) => enqueueAwardCeremony(tx, championInput('cat-a', 'a1')))
    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-a' },
    })
    if (!queue) throw new Error('missing queue')

    await prisma.$transaction((tx) => enqueueAwardCeremony(tx, championInput('cat-b', 'b1')))

    await expect(
      reorderQueueCategory({
        operationId: 'op-stale-reorder',
        queueId: queue.id,
        action: 'moveDown',
        expectedQueueRevision: 1,
      }),
    ).rejects.toMatchObject({ code: 'QUEUE_REVISION_CONFLICT' })
  })

  it('rejects stale reorder after auto-complete bumps queueRevision', async () => {
    await prisma.$transaction(async (tx) => {
      await enqueueAwardCeremony(tx, duoInput('cat-complete-a'))
      await enqueueAwardCeremony(tx, championInput('cat-complete-b', 'b1'))
    })

    const [active, pending] = await Promise.all([
      prisma.awardCeremonyQueue.findFirst({
        where: { categoryKey: 'cat-complete-a' },
        include: { placements: true },
      }),
      prisma.awardCeremonyQueue.findFirst({ where: { categoryKey: 'cat-complete-b' } }),
    ])
    if (!active?.placements[0] || !active.placements[1] || !pending) {
      throw new Error('missing queues')
    }

    const settingsBefore = await prisma.awardsPageSetting.findUnique({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })
    const staleQueueRevision = settingsBefore?.queueRevision

    await updatePlacementStatus({
      operationId: 'op-start',
      queueId: active.id,
      placementId: active.placements[0].id,
      expectedRevision: active.revision,
      status: 'AWARDED',
    })

    const inProgress = await prisma.awardCeremonyQueue.findUnique({
      where: { id: active.id },
      include: { placements: true },
    })
    if (!inProgress?.placements[1]) throw new Error('missing in-progress queue')

    await updatePlacementStatus({
      operationId: 'op-finish',
      queueId: inProgress.id,
      placementId: inProgress.placements[1].id,
      expectedRevision: inProgress.revision,
      status: 'AWARDED',
    })

    await expect(
      reorderQueueCategory({
        operationId: 'op-stale-after-complete',
        queueId: pending.id,
        action: 'moveDown',
        expectedQueueRevision: staleQueueRevision,
      }),
    ).rejects.toMatchObject({ code: 'QUEUE_REVISION_CONFLICT' })
  })

  it('allows only one concurrent placement CAS update to succeed', async () => {
    await prisma.$transaction((tx) => enqueueAwardCeremony(tx, duoInput('cat-cas')))

    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-cas' },
      include: { placements: true },
    })
    if (!queue?.placements[0] || !queue.placements[1]) throw new Error('missing queue')

    const results = await Promise.allSettled([
      updatePlacementStatus({
        operationId: 'op-cas-a',
        queueId: queue.id,
        placementId: queue.placements[0].id,
        expectedRevision: queue.revision,
        status: 'AWARDED',
      }),
      updatePlacementStatus({
        operationId: 'op-cas-b',
        queueId: queue.id,
        placementId: queue.placements[1].id,
        expectedRevision: queue.revision,
        status: 'AWARDED',
      }),
    ])

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'REVISION_CONFLICT',
    })
  })

  it('serializes auto-complete and moveDown without deadlock', async () => {
    await prisma.$transaction(async (tx) => {
      await enqueueAwardCeremony(tx, duoInput('cat-dead-a'))
      await enqueueAwardCeremony(tx, championInput('cat-dead-b', 'b1'))
      await enqueueAwardCeremony(tx, championInput('cat-dead-c', 'c1'))
    })

    const active = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-dead-a' },
      include: { placements: true },
    })
    const movable = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-dead-b' },
    })
    if (!active?.placements[0] || !active.placements[1] || !movable) {
      throw new Error('missing queues')
    }

    await updatePlacementStatus({
      operationId: 'op-dead-start',
      queueId: active.id,
      placementId: active.placements[0].id,
      expectedRevision: active.revision,
      status: 'AWARDED',
    })

    const inProgress = await prisma.awardCeremonyQueue.findUnique({
      where: { id: active.id },
      include: { placements: true },
    })
    const settings = await prisma.awardsPageSetting.findUnique({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })
    const pendingPlacement = inProgress?.placements.find((placement) => placement.status === 'PENDING')
    if (!inProgress || !pendingPlacement || !settings) throw new Error('missing state')

    const results = await Promise.allSettled([
      updatePlacementStatus({
        operationId: 'op-dead-finish',
        queueId: inProgress.id,
        placementId: pendingPlacement.id,
        expectedRevision: inProgress.revision,
        status: 'AWARDED',
      }),
      reorderQueueCategory({
        operationId: 'op-dead-move',
        queueId: movable.id,
        action: 'moveDown',
        expectedQueueRevision: settings.queueRevision,
      }),
    ])

    expect(results.every((result) => result.status === 'fulfilled')).toBe(true)

    const completed = await prisma.awardCeremonyQueue.findUnique({ where: { id: active.id } })
    expect(completed?.status).toBe('COMPLETED')
  })

  it('replays reorder with same operationId despite stale expectedQueueRevision', async () => {
    await prisma.$transaction(async (tx) => {
      await enqueueAwardCeremony(tx, championInput('cat-replay-a', 'a1'))
      await enqueueAwardCeremony(tx, championInput('cat-replay-b', 'b1'))
    })

    const [first, second] = await Promise.all([
      prisma.awardCeremonyQueue.findFirst({ where: { categoryKey: 'cat-replay-a' } }),
      prisma.awardCeremonyQueue.findFirst({ where: { categoryKey: 'cat-replay-b' } }),
    ])
    const settings = await prisma.awardsPageSetting.findUnique({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    })
    if (!first || !second || !settings) throw new Error('missing queues')

    const payload = {
      operationId: 'op-reorder-replay',
      queueId: second.id,
      action: 'moveUp' as const,
      expectedQueueRevision: settings.queueRevision,
    }

    const firstResult = await reorderQueueCategory(payload)
    const replay = await reorderQueueCategory({
      ...payload,
      expectedQueueRevision: settings.queueRevision,
    })

    expect(replay).toEqual(firstResult)
    expect(replay.changed).toBe(true)
  })

  it('rejects same operationId with different payload', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await withAwardOperation({
          tx,
          operationId: 'op-reused',
          requestPayload: { value: 1 },
          run: async () => ({ ok: true }),
        })
        return withAwardOperation({
          tx,
          operationId: 'op-reused',
          requestPayload: { value: 2 },
          run: async () => ({ ok: false }),
        })
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' })
  })

  it('assigns sequential ceremonySequence under concurrent bulk complete', async () => {
    await prisma.$transaction(async (tx) => {
      await enqueueAwardCeremony(tx, championInput('cat-seq-a', 'a1'))
      await enqueueAwardCeremony(tx, championInput('cat-seq-b', 'b1'))
    })

    const [first, second] = await Promise.all([
      prisma.awardCeremonyQueue.findFirst({ where: { categoryKey: 'cat-seq-a' } }),
      prisma.awardCeremonyQueue.findFirst({ where: { categoryKey: 'cat-seq-b' } }),
    ])
    if (!first || !second) throw new Error('missing queues')

    const results = await Promise.allSettled([
      bulkCompleteCategory({
        operationId: 'bulk-seq-a',
        queueId: first.id,
        expectedRevision: first.revision,
      }),
      bulkCompleteCategory({
        operationId: 'bulk-seq-b',
        queueId: second.id,
        expectedRevision: second.revision,
      }),
    ])

    expect(results.every((result) => result.status === 'fulfilled')).toBe(true)

    const completed = await prisma.awardCeremonyQueue.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { ceremonySequence: 'asc' },
    })

    expect(completed.map((row) => row.ceremonySequence)).toEqual([1, 2])
  })

  it('allows two categories to be IN_PROGRESS at the same time', async () => {
    await prisma.$transaction(async (tx) => {
      await enqueueAwardCeremony(tx, duoInput('cat-parallel-a'))
      await enqueueAwardCeremony(tx, duoInput('cat-parallel-b'))
    })

    const [first, second] = await Promise.all([
      prisma.awardCeremonyQueue.findFirst({
        where: { categoryKey: 'cat-parallel-a' },
        include: { placements: true },
      }),
      prisma.awardCeremonyQueue.findFirst({
        where: { categoryKey: 'cat-parallel-b' },
        include: { placements: true },
      }),
    ])
    if (!first?.placements[0] || !second?.placements[0]) throw new Error('missing queues')

    await updatePlacementStatus({
      operationId: 'op-parallel-a',
      queueId: first.id,
      placementId: first.placements[0].id,
      expectedRevision: first.revision,
      status: 'AWARDED',
    })

    await updatePlacementStatus({
      operationId: 'op-parallel-b',
      queueId: second.id,
      placementId: second.placements[0].id,
      expectedRevision: second.revision,
      status: 'AWARDED',
    })

    const inProgress = await prisma.awardCeremonyQueue.findMany({
      where: { status: 'IN_PROGRESS' },
      orderBy: { categoryKey: 'asc' },
    })

    expect(inProgress.map((row) => row.categoryKey)).toEqual(['cat-parallel-a', 'cat-parallel-b'])
  })

  it('allows bulk complete while another ceremony is in progress', async () => {
    await prisma.$transaction(async (tx) => {
      await enqueueAwardCeremony(tx, duoInput('cat-guard-a'))
      await enqueueAwardCeremony(tx, championInput('cat-guard-b', 'b1'))
    })

    const [active, pending] = await Promise.all([
      prisma.awardCeremonyQueue.findFirst({
        where: { categoryKey: 'cat-guard-a' },
        include: { placements: true },
      }),
      prisma.awardCeremonyQueue.findFirst({ where: { categoryKey: 'cat-guard-b' } }),
    ])
    if (!active?.placements[0] || !pending) throw new Error('missing queues')

    await updatePlacementStatus({
      operationId: 'op-guard-start',
      queueId: active.id,
      placementId: active.placements[0].id,
      expectedRevision: active.revision,
      status: 'AWARDED',
    })

    await bulkCompleteCategory({
      operationId: 'op-guard-bulk',
      queueId: pending.id,
      expectedRevision: pending.revision,
    })

    const [activeAfter, pendingAfter] = await Promise.all([
      prisma.awardCeremonyQueue.findUnique({ where: { id: active.id } }),
      prisma.awardCeremonyQueue.findUnique({ where: { id: pending.id } }),
    ])

    expect(activeAfter?.status).toBe('IN_PROGRESS')
    expect(pendingAfter?.status).toBe('COMPLETED')
  })

  it('bulk completes champion category with one awarded placement', async () => {
    await prisma.$transaction((tx) =>
      enqueueAwardCeremony(tx, championInput('cat-champion', 'solo')),
    )

    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-champion' },
      include: { placements: true },
    })
    if (!queue) throw new Error('missing queue')

    await bulkCompleteCategory({
      operationId: 'op-champion-bulk',
      queueId: queue.id,
      expectedRevision: queue.revision,
    })

    const completed = await prisma.awardCeremonyQueue.findUnique({
      where: { id: queue.id },
      include: { placements: true },
    })

    expect(completed?.status).toBe('COMPLETED')
    expect(completed?.placements).toHaveLength(1)
    expect(completed?.placements[0]?.status).toBe('AWARDED')
  })

  it('syncOnCorrection replaces bronze entrant while keeping four placements', async () => {
    await prisma.$transaction((tx) =>
      enqueueAwardCeremony(tx, olympicTwoInput('cat-oly')),
    )

    await prisma.$transaction((tx) =>
      syncAwardCeremonyOnCorrection(tx, {
        categoryKey: 'cat-oly',
        newResult: {
          status: 'complete',
          placements: [
            { entryId: 'gold', placement: 1, reason: 'FINAL_WINNER' },
            { entryId: 'silver', placement: 2, reason: 'FINAL_LOSER' },
            { entryId: 'bronze-a', placement: 3, reason: 'BRONZE_TWO' },
            { entryId: 'bronze-c', placement: 3, reason: 'BRONZE_TWO' },
          ],
        },
        participants: [
          { entryId: 'gold', displayName: 'Gold G', clubName: 'C1' },
          { entryId: 'silver', displayName: 'Silver S', clubName: 'C2' },
          { entryId: 'bronze-a', displayName: 'Bronze A', clubName: 'C3' },
          { entryId: 'bronze-c', displayName: 'Bronze C', clubName: 'C5' },
        ],
        bracketStatus: 'complete',
      }),
    )

    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-oly' },
      include: { placements: true },
    })

    expect(queue?.placements).toHaveLength(4)
    expect(queue?.placements.map((row) => row.entryId).sort()).toEqual([
      'bronze-a',
      'bronze-c',
      'gold',
      'silver',
    ])
  })

  it('keeps IN_PROGRESS and sets needsReview on regression', async () => {
    await prisma.$transaction((tx) => enqueueAwardCeremony(tx, duoInput('cat-review')))

    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-review' },
      include: { placements: true },
    })
    if (!queue?.placements[0]) throw new Error('missing queue')

    await updatePlacementStatus({
      operationId: 'op-review-start',
      queueId: queue.id,
      placementId: queue.placements[0].id,
      expectedRevision: queue.revision,
      status: 'AWARDED',
    })

    await prisma.$transaction((tx) =>
      syncAwardCeremonyOnCorrection(tx, {
        categoryKey: 'cat-review',
        newResult: null,
        participants: [],
        bracketStatus: 'in_progress',
      }),
    )

    const updated = await prisma.awardCeremonyQueue.findUnique({ where: { id: queue.id } })
    expect(updated?.status).toBe('IN_PROGRESS')
    expect(updated?.needsReview).toBe(true)
    expect(updated?.conflictReason).toBeTruthy()
  })

  it('resumes suspended category at the end of its queue group', async () => {
    await prisma.$transaction(async (tx) => {
      await enqueueAwardCeremony(tx, championInput('cat-resume-a', 'a1'))
      await enqueueAwardCeremony(tx, championInput('cat-resume-b', 'b1'))
    })

    await prisma.$transaction((tx) =>
      syncAwardCeremonyOnCorrection(tx, {
        categoryKey: 'cat-resume-b',
        newResult: null,
        participants: [],
        bracketStatus: 'in_progress',
      }),
    )

    await prisma.$transaction((tx) =>
      enqueueAwardCeremony(tx, championInput('cat-resume-c', 'c1')),
    )

    await prisma.$transaction((tx) =>
      resumeOrEnqueueAwardCeremony(tx, championInput('cat-resume-b', 'b1')),
    )

    const pending = await prisma.awardCeremonyQueue.findMany({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID, status: 'PENDING' },
      orderBy: [{ queueGroup: 'asc' }, { queueOrder: 'asc' }],
    })

    expect(pending.map((row) => row.categoryKey)).toEqual([
      'cat-resume-a',
      'cat-resume-c',
      'cat-resume-b',
    ])
  })

  it('includes needsReview categories in admin dashboard timeline', async () => {
    await prisma.$transaction((tx) => enqueueAwardCeremony(tx, duoInput('cat-dash')))

    const queue = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-dash' },
    })
    if (!queue) throw new Error('missing queue')

    await prisma.awardCeremonyQueue.update({
      where: { id: queue.id },
      data: {
        needsReview: true,
        conflictReason: 'test conflict',
      },
    })

    const dashboard = await getAdminAwardsDashboard()
    expect(dashboard.needsReview).toHaveLength(1)
    expect(dashboard.needsReview[0]?.categoryKey).toBe('cat-dash')
    expect(dashboard.needsReview[0]?.conflictReason).toBe('test conflict')
  })

  it('rejects placement update with stale revision after syncOnCorrection', async () => {
    await prisma.$transaction((tx) =>
      enqueueAwardCeremony(tx, olympicTwoInput('cat-sync-stale')),
    )

    const before = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-sync-stale' },
      include: { placements: true },
    })
    if (!before?.placements[0]) throw new Error('missing queue')

    await prisma.$transaction((tx) =>
      syncAwardCeremonyOnCorrection(tx, {
        categoryKey: 'cat-sync-stale',
        newResult: {
          status: 'complete',
          placements: [
            { entryId: 'gold', placement: 1, reason: 'FINAL_WINNER' },
            { entryId: 'silver', placement: 2, reason: 'FINAL_LOSER' },
            { entryId: 'bronze-a', placement: 3, reason: 'BRONZE_TWO' },
            { entryId: 'bronze-c', placement: 3, reason: 'BRONZE_TWO' },
          ],
        },
        participants: [
          { entryId: 'gold', displayName: 'Gold G', clubName: 'C1' },
          { entryId: 'silver', displayName: 'Silver S', clubName: 'C2' },
          { entryId: 'bronze-a', displayName: 'Bronze A', clubName: 'C3' },
          { entryId: 'bronze-c', displayName: 'Bronze C', clubName: 'C5' },
        ],
        bracketStatus: 'complete',
      }),
    )

    const after = await prisma.awardCeremonyQueue.findFirst({
      where: { categoryKey: 'cat-sync-stale' },
      include: { placements: true },
    })
    if (!after?.placements[0]) throw new Error('missing updated queue')

    expect(after.revision).toBe(before.revision + 1)

    await expect(
      updatePlacementStatus({
        operationId: 'op-stale-after-sync',
        queueId: after.id,
        placementId: after.placements[0].id,
        expectedRevision: before.revision,
        status: 'AWARDED',
      }),
    ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' })
  })

  it('returns null from getPublicAwards when public page is disabled', async () => {
    await prisma.awardsPageSetting.update({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
      data: { publicEnabled: false },
    })

    expect(await getPublicAwards()).toBeNull()

    await prisma.awardsPageSetting.update({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
      data: { publicEnabled: true },
    })

    const publicAwards = await getPublicAwards()
    expect(publicAwards).not.toBeNull()
    expect(publicAwards?.queue).toEqual([])
  })
})
