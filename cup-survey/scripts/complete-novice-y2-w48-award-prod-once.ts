#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Acceptance B tail fix: complete interrupted award ceremony for
 * close_control:novice:m_youths_2:m_youths_2_w_le_48 (2nd place left PENDING).
 */
import { prisma } from '../lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'

const CATEGORY_KEY = 'close_control:novice:m_youths_2:m_youths_2_w_le_48'

async function main() {
  const now = new Date()
  const outcome = await prisma.$transaction(async (tx) => {
    const queue = await tx.awardCeremonyQueue.findUnique({
      where: {
        tournamentScopeId_categoryKey: {
          tournamentScopeId: TOURNAMENT_SCOPE_ID,
          categoryKey: CATEGORY_KEY,
        },
      },
      include: { placements: { orderBy: { placementIndex: 'asc' } } },
    })
    if (!queue) throw new Error('award queue missing')
    if (queue.status === 'COMPLETED') {
      return { ok: true, alreadyComplete: true, categoryKey: CATEGORY_KEY }
    }

    const pending = queue.placements.filter((row) => row.status === 'PENDING')
    for (const placement of pending) {
      await tx.awardCeremonyPlacement.update({
        where: { id: placement.id },
        data: { status: 'AWARDED', resolvedAt: now },
      })
    }

    await tx.awardCeremonyQueue.update({
      where: { id: queue.id },
      data: {
        status: 'COMPLETED',
        ceremonyCompletedAt: now,
        actualEndAt: now,
        revision: { increment: 1 },
      },
    })

    await tx.awardsPageSetting.update({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
      data: { queueRevision: { increment: 1 } },
    })

    return {
      ok: true,
      categoryKey: CATEGORY_KEY,
      previousStatus: queue.status,
      awardedPending: pending.map((row) => row.placement),
      newStatus: 'COMPLETED',
    }
  })

  console.log(JSON.stringify(outcome, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
