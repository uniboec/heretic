import type { Prisma } from '@prisma/client'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { prisma } from '@/lib/prisma'
import { PlacementNotFoundError, QueueRevisionConflictError } from './errors'
import { withAwardOperation } from './idempotency'
import { assignCeremonySequence } from './schedule/assignCeremonySequence'
import {
  assertAndBumpCategoryRevisionCAS,
  bumpCategoryRevision,
  bumpQueueRevision,
  lockCategoryForUpdate,
  withAwardsScopeLock,
} from './scopeLock'
import type { AwardsPageSettings, QueueWithPlacements } from './types'

async function loadAllQueue(
  tx: Prisma.TransactionClient,
  scopeId: string,
): Promise<QueueWithPlacements[]> {
  return tx.awardCeremonyQueue.findMany({
    where: { tournamentScopeId: scopeId },
    include: { placements: true },
  })
}

async function loadQueueById(
  tx: Prisma.TransactionClient,
  queueId: string,
): Promise<QueueWithPlacements | null> {
  return tx.awardCeremonyQueue.findUnique({
    where: { id: queueId },
    include: { placements: true },
  })
}

async function loadPlacementScoped(
  tx: Prisma.TransactionClient,
  placementId: string,
  queueId: string,
) {
  return tx.awardCeremonyPlacement.findFirst({
    where: { id: placementId, queueId },
  })
}

function allPlacementsResolved(queue: QueueWithPlacements): boolean {
  return queue.placements.every((placement) => placement.status !== 'PENDING')
}

async function applyPlacementCategoryTransition(input: {
  tx: Prisma.TransactionClient
  queueId: string
  previousStatus: string
  settings: AwardsPageSettings
  allQueue: QueueWithPlacements[]
  now: Date
  refreshed: QueueWithPlacements
  currentQueueRevision: number
}): Promise<number> {
  const {
    tx,
    queueId,
    previousStatus,
    settings,
    allQueue,
    now,
    refreshed,
    currentQueueRevision,
  } = input

  if (previousStatus === 'PENDING') {
    if (allPlacementsResolved(refreshed)) {
      await assignCeremonySequence({
        tx,
        queue: refreshed,
        settings,
        allQueue,
        now,
      })
      await tx.awardCeremonyQueue.update({
        where: { id: queueId },
        data: {
          status: 'COMPLETED',
          ceremonyCompletedAt: now,
          actualEndAt: now,
        },
      })
      return bumpQueueRevision(tx, TOURNAMENT_SCOPE_ID)
    }

    await assignCeremonySequence({
      tx,
      queue: refreshed,
      settings,
      allQueue,
      now,
    })
    return bumpQueueRevision(tx, TOURNAMENT_SCOPE_ID)
  }

  if (previousStatus === 'IN_PROGRESS' && allPlacementsResolved(refreshed)) {
    await tx.awardCeremonyQueue.update({
      where: { id: queueId },
      data: {
        status: 'COMPLETED',
        ceremonyCompletedAt: now,
        actualEndAt: now,
      },
    })
    return bumpQueueRevision(tx, TOURNAMENT_SCOPE_ID)
  }

  return currentQueueRevision
}

async function applyLateAward(
  tx: Prisma.TransactionClient,
  input: {
    queueId: string
    placementId: string
    expectedRevision: number
  },
) {
  return withAwardsScopeLock(tx, TOURNAMENT_SCOPE_ID, async ({ settings }) => {
    await lockCategoryForUpdate(tx, input.queueId)

    const placement = await loadPlacementScoped(tx, input.placementId, input.queueId)
    if (!placement) {
      throw new PlacementNotFoundError()
    }

    const queue = await loadQueueById(tx, input.queueId)
    if (!queue) {
      throw new Error('Queue not found')
    }

    if (placement.status === 'AWARDED') {
      return {
        queueId: input.queueId,
        revision: queue.revision,
        queueRevision: settings.queueRevision,
      }
    }

    await assertAndBumpCategoryRevisionCAS(tx, input.queueId, input.expectedRevision)
    const now = new Date()
    await tx.awardCeremonyPlacement.update({
      where: { id: input.placementId },
      data: {
        status: 'AWARDED',
        resolvedAt: now,
      },
    })
    const updated = await loadQueueById(tx, input.queueId)
    return {
      queueId: input.queueId,
      revision: updated?.revision ?? input.expectedRevision + 1,
      queueRevision: settings.queueRevision,
    }
  })
}

export async function updatePlacementStatus(input: {
  operationId: string
  queueId: string
  placementId: string
  expectedRevision: number
  status: 'AWARDED' | 'NOT_AWARDED' | 'PENDING'
}) {
  const result = await prisma.$transaction(async (tx) =>
    withAwardOperation({
      tx,
      operationId: input.operationId,
      requestPayload: input,
      run: async () => {
        const preQueue = await loadQueueById(tx, input.queueId)
        if (!preQueue) {
          throw new Error('Queue not found')
        }

        if (preQueue.status === 'COMPLETED' && input.status === 'AWARDED') {
          return applyLateAward(tx, input)
        }

        return withAwardsScopeLock(tx, TOURNAMENT_SCOPE_ID, async ({ settings }) => {
          await lockCategoryForUpdate(tx, input.queueId)

          const queue = await loadQueueById(tx, input.queueId)
          if (!queue) {
            throw new Error('Queue not found')
          }

          const placement = await loadPlacementScoped(tx, input.placementId, input.queueId)
          if (!placement) {
            throw new PlacementNotFoundError()
          }

          if (placement.status === input.status) {
            return {
              queueId: input.queueId,
              revision: queue.revision,
              queueRevision: settings.queueRevision,
            }
          }

          await assertAndBumpCategoryRevisionCAS(tx, input.queueId, input.expectedRevision)

          const now = new Date()
          const previousStatus = queue.status

          await tx.awardCeremonyPlacement.update({
            where: { id: input.placementId },
            data: {
              status: input.status,
              resolvedAt: input.status === 'PENDING' ? null : now,
            },
          })

          let queueRevision = settings.queueRevision

          if (previousStatus === 'COMPLETED' && input.status === 'PENDING') {
            await tx.awardCeremonyQueue.update({
              where: { id: input.queueId },
              data: {
                status: 'IN_PROGRESS',
                actualEndAt: null,
                ceremonyCompletedAt: null,
              },
            })
            queueRevision = await bumpQueueRevision(tx, TOURNAMENT_SCOPE_ID)
          } else if (previousStatus !== 'COMPLETED') {
            const allQueue = await loadAllQueue(tx, TOURNAMENT_SCOPE_ID)
            const refreshed = await loadQueueById(tx, input.queueId)
            if (!refreshed) {
              throw new Error('Queue not found')
            }

            queueRevision = await applyPlacementCategoryTransition({
              tx,
              queueId: input.queueId,
              previousStatus,
              settings,
              allQueue,
              now,
              refreshed,
              currentQueueRevision: queueRevision,
            })
          }

          const finalQueue = await loadQueueById(tx, input.queueId)
          return {
            queueId: input.queueId,
            revision: finalQueue?.revision ?? input.expectedRevision + 1,
            queueRevision,
          }
        })
      },
    }),
  )
  const { scheduleAwardAnnouncerSync } = await import('../announcer/hooks/scheduleAwardSync')
  scheduleAwardAnnouncerSync()
  return result
}

export async function bulkCompleteCategory(input: {
  operationId: string
  queueId: string
  expectedRevision: number
}) {
  const result = await prisma.$transaction(async (tx) =>
    withAwardOperation({
      tx,
      operationId: input.operationId,
      requestPayload: input,
      run: async () =>
        withAwardsScopeLock(tx, TOURNAMENT_SCOPE_ID, async ({ settings }) => {
          await lockCategoryForUpdate(tx, input.queueId)
          await assertAndBumpCategoryRevisionCAS(tx, input.queueId, input.expectedRevision)

          const queue = await loadQueueById(tx, input.queueId)
          if (!queue) {
            throw new Error('Queue not found')
          }
          if (queue.status !== 'PENDING' && queue.status !== 'IN_PROGRESS') {
            throw new Error('Category cannot be completed')
          }

          const now = new Date()

          if (queue.status === 'PENDING') {
            const allQueue = await loadAllQueue(tx, TOURNAMENT_SCOPE_ID)
            await assignCeremonySequence({
              tx,
              queue,
              settings,
              allQueue,
              now,
            })
          }

          await tx.awardCeremonyPlacement.updateMany({
            where: { queueId: input.queueId, status: 'PENDING' },
            data: { status: 'AWARDED', resolvedAt: now },
          })

          await tx.awardCeremonyQueue.update({
            where: { id: input.queueId },
            data: {
              status: 'COMPLETED',
              ceremonyCompletedAt: now,
              actualEndAt: now,
            },
          })

          const queueRevision = await bumpQueueRevision(tx, TOURNAMENT_SCOPE_ID)
          const finalQueue = await loadQueueById(tx, input.queueId)
          return {
            queueId: input.queueId,
            revision: finalQueue?.revision ?? input.expectedRevision + 1,
            queueRevision,
          }
        }),
    }),
  )
  const { scheduleAwardAnnouncerSync } = await import('../announcer/hooks/scheduleAwardSync')
  scheduleAwardAnnouncerSync()
  return result
}

async function normalizeGroupOrders(
  tx: Prisma.TransactionClient,
  scopeId: string,
  queueGroup: 'NORMAL' | 'DEFERRED',
): Promise<void> {
  const rows = await tx.awardCeremonyQueue.findMany({
    where: { tournamentScopeId: scopeId, queueGroup, status: 'PENDING' },
    orderBy: { queueOrder: 'asc' },
  })
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index]?.queueOrder !== index) {
      await tx.awardCeremonyQueue.update({
        where: { id: rows[index]!.id },
        data: { queueOrder: index },
      })
    }
  }
}

async function maxGroupOrder(
  tx: Prisma.TransactionClient,
  scopeId: string,
  queueGroup: 'NORMAL' | 'DEFERRED',
): Promise<number> {
  const row = await tx.awardCeremonyQueue.findFirst({
    where: { tournamentScopeId: scopeId, queueGroup, status: 'PENDING' },
    orderBy: { queueOrder: 'desc' },
    select: { queueOrder: true },
  })
  return row?.queueOrder ?? -1
}

export async function reorderQueueCategory(input: {
  operationId: string
  queueId: string
  action: 'moveUp' | 'moveDown' | 'moveToEnd' | 'moveToNormal'
  expectedQueueRevision: number
}) {
  const result = await prisma.$transaction(async (tx) =>
    withAwardOperation({
      tx,
      operationId: input.operationId,
      requestPayload: input,
      run: async () =>
        withAwardsScopeLock(tx, TOURNAMENT_SCOPE_ID, async ({ settings }) => {
          if (settings.queueRevision !== input.expectedQueueRevision) {
            throw new QueueRevisionConflictError()
          }

          await lockCategoryForUpdate(tx, input.queueId)

          const queue = await tx.awardCeremonyQueue.findUnique({
            where: { id: input.queueId },
          })
          if (!queue || queue.status !== 'PENDING' || queue.ceremonySequence != null) {
            throw new Error('Category cannot be reordered')
          }

          let changed = false
          const scopeId = TOURNAMENT_SCOPE_ID

          if (input.action === 'moveToEnd') {
            if (queue.queueGroup !== 'DEFERRED') {
              await tx.awardCeremonyQueue.update({
                where: { id: queue.id },
                data: {
                  queueGroup: 'DEFERRED',
                  queueOrder: (await maxGroupOrder(tx, scopeId, 'DEFERRED')) + 1,
                },
              })
              changed = true
            }
          } else if (input.action === 'moveToNormal') {
            if (queue.queueGroup !== 'NORMAL') {
              await tx.awardCeremonyQueue.update({
                where: { id: queue.id },
                data: {
                  queueGroup: 'NORMAL',
                  queueOrder: (await maxGroupOrder(tx, scopeId, 'NORMAL')) + 1,
                },
              })
              changed = true
            }
          } else {
            const groupRows = await tx.awardCeremonyQueue.findMany({
              where: {
                tournamentScopeId: scopeId,
                queueGroup: queue.queueGroup,
                status: 'PENDING',
              },
              orderBy: { queueOrder: 'asc' },
            })
            const index = groupRows.findIndex((row) => row.id === queue.id)
            const swapIndex = input.action === 'moveUp' ? index - 1 : index + 1
            if (index >= 0 && swapIndex >= 0 && swapIndex < groupRows.length) {
              const current = groupRows[index]!
              const swap = groupRows[swapIndex]!
              await tx.awardCeremonyQueue.update({
                where: { id: current.id },
                data: { queueOrder: swap.queueOrder },
              })
              await tx.awardCeremonyQueue.update({
                where: { id: swap.id },
                data: { queueOrder: current.queueOrder },
              })
              changed = true
            }
          }

          if (changed) {
            await normalizeGroupOrders(tx, scopeId, 'NORMAL')
            await normalizeGroupOrders(tx, scopeId, 'DEFERRED')
          }

          const queueRevision = changed
            ? await bumpQueueRevision(tx, scopeId)
            : settings.queueRevision

          return { queueRevision, changed }
        }),
    }),
  )
  const { scheduleAwardAnnouncerSync } = await import('../announcer/hooks/scheduleAwardSync')
  scheduleAwardAnnouncerSync()
  return result
}

export async function updateCategoryComment(input: {
  operationId: string
  queueId: string
  expectedRevision: number
  adminComment?: string | null
  publicComment?: string | null
}) {
  return prisma.$transaction(async (tx) =>
    withAwardOperation({
      tx,
      operationId: input.operationId,
      requestPayload: input,
      run: async () =>
        withAwardsScopeLock(tx, TOURNAMENT_SCOPE_ID, async () => {
          await lockCategoryForUpdate(tx, input.queueId)
          await assertAndBumpCategoryRevisionCAS(tx, input.queueId, input.expectedRevision)
          await tx.awardCeremonyQueue.update({
            where: { id: input.queueId },
            data: {
              ...(input.adminComment !== undefined ? { adminComment: input.adminComment } : {}),
              ...(input.publicComment !== undefined ? { publicComment: input.publicComment } : {}),
            },
          })
          const queue = await loadQueueById(tx, input.queueId)
          return {
            queueId: input.queueId,
            revision: queue?.revision ?? input.expectedRevision + 1,
          }
        }),
    }),
  )
}

export async function updatePlacementComment(input: {
  operationId: string
  queueId: string
  placementId: string
  expectedRevision: number
  adminComment?: string | null
  publicComment?: string | null
}) {
  return prisma.$transaction(async (tx) =>
    withAwardOperation({
      tx,
      operationId: input.operationId,
      requestPayload: input,
      run: async () =>
        withAwardsScopeLock(tx, TOURNAMENT_SCOPE_ID, async () => {
          await lockCategoryForUpdate(tx, input.queueId)

          const placement = await loadPlacementScoped(tx, input.placementId, input.queueId)
          if (!placement) {
            throw new PlacementNotFoundError()
          }

          await assertAndBumpCategoryRevisionCAS(tx, input.queueId, input.expectedRevision)
          await tx.awardCeremonyPlacement.update({
            where: { id: input.placementId },
            data: {
              ...(input.adminComment !== undefined ? { adminComment: input.adminComment } : {}),
              ...(input.publicComment !== undefined ? { publicComment: input.publicComment } : {}),
            },
          })
          const queue = await loadQueueById(tx, input.queueId)
          return {
            queueId: input.queueId,
            placementId: input.placementId,
            revision: queue?.revision ?? input.expectedRevision + 1,
          }
        }),
    }),
  )
}

export async function resolveReview(input: {
  queueId: string
}) {
  return prisma.$transaction(async (tx) => {
    await tx.awardCeremonyQueue.update({
      where: { id: input.queueId },
      data: { needsReview: false, conflictReason: null },
    })
    await bumpCategoryRevision(tx, input.queueId)
    const queue = await loadQueueById(tx, input.queueId)
    return { queueId: input.queueId, revision: queue?.revision ?? 0 }
  })
}
