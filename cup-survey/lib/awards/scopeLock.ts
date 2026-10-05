import type { Prisma } from '@prisma/client'
import type { AwardsPageSettings } from './types'
import { AwardsPageSettingMissingError } from './errors'

export async function lockCategoryForUpdate(
  tx: Prisma.TransactionClient,
  queueId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "AwardCeremonyQueue"
    WHERE id = ${queueId}
    FOR UPDATE
  `
  if (!rows[0]) {
    throw new Error('Queue not found')
  }
}

export async function withAwardsScopeLock<T>(
  tx: Prisma.TransactionClient,
  tournamentScopeId: string,
  run: (ctx: { settings: AwardsPageSettings }) => Promise<T>,
): Promise<T> {
  const rows = await tx.$queryRaw<AwardsPageSettings[]>`
    SELECT * FROM "AwardsPageSetting"
    WHERE "tournamentScopeId" = ${tournamentScopeId}
    FOR UPDATE
  `
  if (!rows[0]) {
    throw new AwardsPageSettingMissingError()
  }
  return run({ settings: rows[0] })
}

export async function bumpQueueRevision(
  tx: Prisma.TransactionClient,
  tournamentScopeId: string,
): Promise<number> {
  const updated = await tx.awardsPageSetting.update({
    where: { tournamentScopeId },
    data: { queueRevision: { increment: 1 } },
  })
  return updated.queueRevision
}

export async function bumpCategoryRevision(
  tx: Prisma.TransactionClient,
  queueId: string,
): Promise<number> {
  const updated = await tx.awardCeremonyQueue.update({
    where: { id: queueId },
    data: { revision: { increment: 1 } },
  })
  return updated.revision
}

export async function assertAndBumpCategoryRevisionCAS(
  tx: Prisma.TransactionClient,
  queueId: string,
  expectedRevision: number,
): Promise<void> {
  const updated = await tx.awardCeremonyQueue.updateMany({
    where: { id: queueId, revision: expectedRevision },
    data: { revision: { increment: 1 } },
  })
  if (updated.count !== 1) {
    const { RevisionConflictError } = await import('./errors')
    throw new RevisionConflictError()
  }
}
