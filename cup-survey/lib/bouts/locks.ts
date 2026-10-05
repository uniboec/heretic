import type { Prisma } from '@prisma/client'
import { BoutsPageSettingMissingError } from './errors'

/** Tournament coordination lock — must be first in every release/matCount/publish tx. */
export async function lockBoutsPageSetting(tx: Prisma.TransactionClient) {
  const existing = await tx.boutsPageSetting.findUnique({ where: { id: 'default' } })
  if (!existing) {
    throw new BoutsPageSettingMissingError()
  }
  await tx.$executeRaw`SELECT id FROM "BoutsPageSetting" WHERE id = 'default' FOR UPDATE`
  return tx.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
}

export async function lockMatScheduleRuntimeRows(
  tx: Prisma.TransactionClient,
  matIndexes: number[],
) {
  const sorted = [...new Set(matIndexes)].sort((a, b) => a - b)
  for (const matIndex of sorted) {
    await tx.$executeRaw`
      SELECT "matIndex" FROM "MatScheduleRuntime"
      WHERE "matIndex" = ${matIndex}
      FOR UPDATE
    `
  }
  return tx.matScheduleRuntime.findMany({
    where: { matIndex: { in: sorted } },
  })
}
