import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'

export async function enableAutoMatByCategory(
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "BoutsPageSetting" WHERE id = 'default' FOR UPDATE
  `
  if (rows.length !== 1) {
    throw new Error('BoutsPageSetting(id=default) not found — abort cutover')
  }

  const current = await db.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
  if (current.autoMatByCategoryEnabled) {
    if (current.autoMatAssignMode === 'BY_CATEGORY') {
      return current
    }

    return db.boutsPageSetting.update({
      where: { id: 'default' },
      data: { autoMatAssignMode: 'BY_CATEGORY' },
    })
  }

  const updated = await db.$executeRaw`
    UPDATE "BoutsPageSetting"
    SET
      "autoMatByCategoryEnabled" = true,
      "autoMatAssignMode" = 'BY_CATEGORY'::"AutoMatAssignMode"
    WHERE id = 'default'
      AND "autoMatByCategoryEnabled" = false
  `

  if (updated !== 1) {
    throw new Error('Cutover preconditions failed: expected autoMatByCategoryEnabled=false')
  }

  return db.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
}
