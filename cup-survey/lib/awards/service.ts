import { Prisma } from '@prisma/client'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { prisma } from '@/lib/prisma'
import { toAdminAwardsDto } from './dto/admin'
import { toPublicAwardDto } from './dto/public'
import { buildRemainingMedals } from './remainingMedals'
import { buildCeremonySchedule } from './schedule/buildCeremonySchedule'
import { ensureAwardsPageSettings, getAwardsPageSettings } from './settings'
import type { QueueWithPlacements } from './types'

async function loadQueueWithPlacements(
  tx: Prisma.TransactionClient,
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<QueueWithPlacements[]> {
  return tx.awardCeremonyQueue.findMany({
    where: { tournamentScopeId: scopeId },
    include: { placements: true },
  })
}

export async function getPublicAwards() {
  const settings = await getAwardsPageSettings()
  if (!settings.publicEnabled) {
    return null
  }

  const generatedAt = new Date()

  return prisma.$transaction(
    async (tx) => {
      const queue = await loadQueueWithPlacements(tx)
      const scheduled = buildCeremonySchedule({
        queue,
        settings,
        now: generatedAt,
        includeStatuses: ['PENDING', 'IN_PROGRESS', 'COMPLETED'],
      })

      const categoryComments = new Map(queue.map((item) => [item.id, item.publicComment]))
      const placementComments = new Map(
        queue.flatMap((item) => item.placements.map((placement) => [placement.id, placement.publicComment])),
      )
      const completedTimestamps = new Map(
        queue.map((item) => [item.id, item.ceremonyCompletedAt]),
      )
      const ceremonySequences = new Map(
        queue.map((item) => [item.id, item.ceremonySequence]),
      )

      return toPublicAwardDto({
        ceremonyStartTime: settings.ceremonyStartTime,
        generatedAt,
        scheduled,
        categoryComments,
        placementComments,
        completedTimestamps,
        ceremonySequences,
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  )
}

export async function getAdminAwardsDashboard() {
  await ensureAwardsPageSettings()
  const settings = await getAwardsPageSettings()
  const queue = await prisma.awardCeremonyQueue.findMany({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    include: { placements: true },
    orderBy: [{ queueGroup: 'asc' }, { queueOrder: 'asc' }],
  })
  const now = new Date()
  const scheduled = buildCeremonySchedule({ queue, settings, now })
  const remainingMedals = buildRemainingMedals(queue)

  return toAdminAwardsDto({
    settings,
    queue,
    scheduled,
    remainingMedals,
  })
}
