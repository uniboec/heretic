/**
 * Phase 2 cutover: enable BY_CATEGORY feature marker on singleton row.
 * Run once per environment after Phase-1 code is deployed everywhere.
 */
import { enableAutoMatByCategory } from '../lib/bouts/enableAutoMatByCategory'
import { prisma } from '../lib/prisma'

async function main() {
  const result = await prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))

  console.log('Auto mat BY_CATEGORY enabled:', {
    autoMatAssignMode: result.autoMatAssignMode,
    autoMatByCategoryEnabled: result.autoMatByCategoryEnabled,
  })
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
