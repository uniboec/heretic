import { compactFrozenPrefixOnMats } from '../lib/bouts/compactFrozenPrefixOnMats'
import { rebuildLegacyFrozenScheduleNumbers } from '../lib/bouts/rebuildLegacyFrozenScheduleNumbers'
import { prisma } from '../lib/prisma'

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const compact = await compactFrozenPrefixOnMats({ dryRun })
  console.log('compactFrozenPrefixOnMats:', JSON.stringify(compact, null, 2))

  const result = await rebuildLegacyFrozenScheduleNumbers({ dryRun })
  console.log('rebuildLegacyFrozenScheduleNumbers:', JSON.stringify(result, null, 2))

  if (!result.invariantOk || !result.frozenPrefixOk) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
