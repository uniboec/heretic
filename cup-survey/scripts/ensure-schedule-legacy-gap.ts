import { prisma } from '../lib/prisma'
import { rebuildLegacyFrozenScheduleNumbers } from '../lib/bouts/rebuildLegacyFrozenScheduleNumbers'

async function main() {
  const dryRun = await rebuildLegacyFrozenScheduleNumbers({ dryRun: true })
  const shouldEnableLegacyGap = !dryRun.frozenPrefixOk

  if (shouldEnableLegacyGap) {
    await prisma.boutsPageSetting.update({
      where: { id: 'default' },
      data: { scheduleLegacyGap: true },
    })
  }

  const settings = await prisma.boutsPageSetting.findUniqueOrThrow({
    where: { id: 'default' },
  })

  console.log(
    JSON.stringify(
      {
        scheduleLegacyGap: settings.scheduleLegacyGap,
        frozenPrefixOk: dryRun.frozenPrefixOk,
        frozenPrefixError: dryRun.frozenPrefixError,
      },
      null,
      2,
    ),
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
