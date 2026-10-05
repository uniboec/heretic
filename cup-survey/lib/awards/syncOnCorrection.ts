import type { Prisma } from '@prisma/client'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import type { CategoryResult } from '@/lib/brackets/core/types'
import { buildPlacementRows } from './placements'
import { bumpCategoryRevision } from './scopeLock'
import { suspendAwardCeremonyOnRegression } from './suspend'
import type { CeremonyParticipantInput } from './types'

function ceremonyStarted(queue: {
  ceremonySequence: number | null
  actualStartAt: Date | null
  status: string
}): boolean {
  return (
    queue.ceremonySequence != null ||
    queue.actualStartAt != null ||
    queue.status === 'COMPLETED' ||
    queue.status === 'IN_PROGRESS'
  )
}

function hasResolvedPlacements(
  placements: Array<{ status: string }>,
): boolean {
  return placements.some((placement) => placement.status !== 'PENDING')
}

export async function syncAwardCeremonyOnCorrection(
  tx: Prisma.TransactionClient,
  input: {
    categoryKey: string
    newResult: CategoryResult | null | undefined
    participants: CeremonyParticipantInput[]
    bracketStatus: 'complete' | 'in_progress'
  },
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<void> {
  const queue = await tx.awardCeremonyQueue.findUnique({
    where: {
      tournamentScopeId_categoryKey: {
        tournamentScopeId: scopeId,
        categoryKey: input.categoryKey,
      },
    },
    include: { placements: true },
  })
  if (!queue) {
    return
  }

  if (input.bracketStatus === 'in_progress') {
    if (
      ceremonyStarted(queue) ||
      hasResolvedPlacements(queue.placements)
    ) {
      await tx.awardCeremonyQueue.update({
        where: { id: queue.id },
        data: {
          needsReview: true,
          conflictReason: 'Результат категории изменился после начала награждения',
        },
      })
      await bumpCategoryRevision(tx, queue.id)
      return
    }

    await suspendAwardCeremonyOnRegression(tx, { categoryKey: input.categoryKey }, scopeId)
    return
  }

  if (!input.newResult || input.newResult.status !== 'complete') {
    return
  }

  if (ceremonyStarted(queue) || hasResolvedPlacements(queue.placements)) {
    await tx.awardCeremonyQueue.update({
      where: { id: queue.id },
      data: {
        needsReview: true,
        conflictReason: 'Результат категории изменился после начала награждения',
      },
    })
    await bumpCategoryRevision(tx, queue.id)
    return
  }

  const allPending = queue.placements.every((placement) => placement.status === 'PENDING')
  if (!allPending) {
    return
  }

  const placementRows = buildPlacementRows({
    result: input.newResult,
    participants: input.participants,
  })

  await tx.awardCeremonyPlacement.deleteMany({ where: { queueId: queue.id } })
  await tx.awardCeremonyQueue.update({
    where: { id: queue.id },
    data: {
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
  await bumpCategoryRevision(tx, queue.id)
}
