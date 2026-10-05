import { prisma } from '../lib/prisma'
import '../lib/brackets/systems'
import { reconcileAllPublishedStructures } from '../lib/brackets/reconcilePublishedStructure'

async function main() {
  const outcome = await prisma.$transaction(async (tx) => reconcileAllPublishedStructures(tx))
  console.log(
    `Reconciled ${outcome.categories} categories (${outcome.totalBouts} bout results replayed)`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
