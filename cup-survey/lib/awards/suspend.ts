import type { Prisma } from '@prisma/client'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { bumpCategoryRevision, bumpQueueRevision, withAwardsScopeLock } from './scopeLock'

export async function suspendAwardCeremonyOnRegression(
  tx: Prisma.TransactionClient,
  input: { categoryKey: string },
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<boolean> {
  return withAwardsScopeLock(tx, scopeId, async () => {
    const queue = await tx.awardCeremonyQueue.findUnique({
      where: {
        tournamentScopeId_categoryKey: {
          tournamentScopeId: scopeId,
          categoryKey: input.categoryKey,
        },
      },
    })
    if (!queue || queue.status === 'SUSPENDED') {
      return false
    }

    await tx.awardCeremonyQueue.update({
      where: { id: queue.id },
      data: { status: 'SUSPENDED' },
    })
    await bumpQueueRevision(tx, scopeId)
    await bumpCategoryRevision(tx, queue.id)
    return true
  })
}
