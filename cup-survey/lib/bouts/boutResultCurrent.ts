import type { Prisma, PrismaClient } from '@prisma/client'
import { getCurrentBoutResult as queryCurrentBoutResult } from './boutResultQueries'

type TransactionClient = Prisma.TransactionClient | PrismaClient

export async function getCurrentBoutResult(tx: TransactionClient, boutId: string) {
  return queryCurrentBoutResult(tx, boutId)
}

export async function swapCurrentBoutResult(
  tx: TransactionClient,
  boutId: string,
  previousResultId: string,
) {
  await tx.boutResult.updateMany({
    where: { boutId, isCurrent: true },
    data: { isCurrent: false },
  })
  await tx.boutResult.update({
    where: { id: previousResultId },
    data: { isCurrent: false, resultStatus: 'SUPERSEDED' },
  })
}
