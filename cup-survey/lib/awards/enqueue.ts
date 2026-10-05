import type { Prisma } from '@prisma/client'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { buildPlacementRows } from './placements'
import { bumpQueueRevision, withAwardsScopeLock } from './scopeLock'
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

export async function enqueueAwardCeremony(
  tx: Prisma.TransactionClient,
  input: CategoryResultInput,
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<boolean> {
  if (!input.result || input.result.status !== 'complete') {
    return false
  }

  return withAwardsScopeLock(tx, scopeId, async () => {
    const existing = await tx.awardCeremonyQueue.findUnique({
      where: {
        tournamentScopeId_categoryKey: {
          tournamentScopeId: scopeId,
          categoryKey: input.categoryKey,
        },
      },
    })
    if (existing) {
      return false
    }

    const placementRows = buildPlacementRows({
      result: input.result,
      participants: input.participants,
    })
    if (placementRows.length === 0) {
      return false
    }

    const nextOrder = (await maxQueueOrder(tx, scopeId, 'NORMAL')) + 1
    const now = new Date()

    await tx.awardCeremonyQueue.create({
      data: {
        tournamentScopeId: scopeId,
        categoryKey: input.categoryKey,
        status: 'PENDING',
        queueGroup: 'NORMAL',
        queueOrder: nextOrder,
        completedAtCategory: now,
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
    return true
  })
}

export async function resumeOrEnqueueAwardCeremony(
  tx: Prisma.TransactionClient,
  input: CategoryResultInput,
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<void> {
  const existing = await tx.awardCeremonyQueue.findUnique({
    where: {
      tournamentScopeId_categoryKey: {
        tournamentScopeId: scopeId,
        categoryKey: input.categoryKey,
      },
    },
  })

  if (existing?.status === 'SUSPENDED') {
    const { resumeFromSuspended } = await import('./resumeFromSuspended')
    await resumeFromSuspended(tx, {
      categoryKey: input.categoryKey,
      result: input.result,
      participants: input.participants,
    }, scopeId)
    return
  }

  await enqueueAwardCeremony(tx, input, scopeId)
}
