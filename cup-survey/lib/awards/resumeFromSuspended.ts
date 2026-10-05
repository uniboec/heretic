import type { Prisma } from '@prisma/client'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { buildPlacementRows } from './placements'
import { bumpCategoryRevision, bumpQueueRevision, withAwardsScopeLock } from './scopeLock'
import type { CategoryResultInput } from './types'

async function maxQueueOrder(
  tx: Prisma.TransactionClient,
  tournamentScopeId: string,
  queueGroup: 'NORMAL' | 'DEFERRED',
): Promise<number> {
  const row = await tx.awardCeremonyQueue.findFirst({
    where: { tournamentScopeId, queueGroup, status: { in: ['PENDING', 'SUSPENDED'] } },
    orderBy: { queueOrder: 'desc' },
    select: { queueOrder: true },
  })
  return row?.queueOrder ?? -1
}

export async function resumeFromSuspended(
  tx: Prisma.TransactionClient,
  input: CategoryResultInput,
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<boolean> {
  if (!input.result || input.result.status !== 'complete') {
    return false
  }

  return withAwardsScopeLock(tx, scopeId, async () => {
    const queue = await tx.awardCeremonyQueue.findUnique({
      where: {
        tournamentScopeId_categoryKey: {
          tournamentScopeId: scopeId,
          categoryKey: input.categoryKey,
        },
      },
      include: { placements: true },
    })
    if (!queue || queue.status !== 'SUSPENDED') {
      return false
    }

    const placementRows = buildPlacementRows({
      result: input.result,
      participants: input.participants,
    })
    const now = new Date()
    const nextOrder =
      (await maxQueueOrder(tx, scopeId, queue.queueGroup === 'DEFERRED' ? 'DEFERRED' : 'NORMAL')) + 1

    await tx.awardCeremonyPlacement.deleteMany({ where: { queueId: queue.id } })
    await tx.awardCeremonyQueue.update({
      where: { id: queue.id },
      data: {
        status: 'PENDING',
        needsReview: false,
        conflictReason: null,
        completedAtCategory: now,
        ceremonyCompletedAt: null,
        actualStartAt: null,
        actualEndAt: null,
        ceremonySequence: null,
        scheduledStartAtSnapshot: null,
        durationMinutesSnapshot: null,
        breakMinutesSnapshot: null,
        queueOrder: nextOrder,
        placements: {
          create: placementRows.map((row) => ({
            entryId: row.entryId,
            placement: row.placement,
            placementIndex: row.placementIndex,
            lastName: row.lastName,
            firstName: row.firstName,
            middleName: row.middleName,
            clubName: row.clubName,
          })),
        },
      },
    })

    await bumpQueueRevision(tx, scopeId)
    await bumpCategoryRevision(tx, queue.id)
    return true
  })
}
