import type { Prisma, PrismaClient } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient | PrismaClient

export const ACTIVE_BOUT_RESULT_WHERE = {
  isCurrent: true,
  resultStatus: 'ACTIVE',
} as const

export async function getCurrentBoutResult(tx: TransactionClient, boutId: string) {
  return tx.boutResult.findFirst({
    where: { boutId, ...ACTIVE_BOUT_RESULT_WHERE },
  })
}

export async function listActiveBoutResultsForCategory(
  tx: TransactionClient,
  categoryKey: string,
) {
  return tx.boutResult.findMany({
    where: {
      boutId: { startsWith: `${categoryKey}::` },
      ...ACTIVE_BOUT_RESULT_WHERE,
    },
  })
}

export async function listActiveBoutResultsForBoutIds(
  tx: TransactionClient,
  boutIds: string[],
) {
  if (boutIds.length === 0) return []
  return tx.boutResult.findMany({
    where: {
      boutId: { in: boutIds },
      ...ACTIVE_BOUT_RESULT_WHERE,
    },
  })
}

export async function listBoutResultVersions(tx: TransactionClient, boutId: string) {
  return tx.boutResult.findMany({
    where: { boutId },
    orderBy: { resultVersion: 'desc' },
  })
}

export async function getBlockingDownstreamExecutions(
  tx: TransactionClient,
  boutIds: string[],
) {
  if (boutIds.length === 0) return []

  const rows = await tx.boutScheduleExecution.findMany({
    where: { boutId: { in: boutIds } },
  })

  return rows.filter((row) =>
    ['live', 'pending_confirmation', 'pending_activity_decision'].includes(row.boutPhase),
  )
}

export async function invalidateAthleteRestForBouts(
  tx: TransactionClient,
  boutIds: string[],
  invalidatedAt: Date = new Date(),
) {
  if (boutIds.length === 0) return

  await tx.athleteRestState.updateMany({
    where: {
      sourceBoutId: { in: boutIds },
      invalidatedAt: null,
    },
    data: { invalidatedAt },
  })
}
