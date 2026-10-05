import { prisma } from '../lib/prisma'

async function main() {
  const settings = await prisma.awardsPageSetting.findUnique({
    where: { tournamentScopeId: 'cup-2026' },
  })
  const queueCount = await prisma.awardCeremonyQueue.count()
  const byStatus = await prisma.awardCeremonyQueue.groupBy({
    by: ['status'],
    _count: true,
  })
  const pendingOrInProgress = await prisma.awardCeremonyQueue.count({
    where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
  })

  console.log(
    JSON.stringify(
      {
        settings,
        queueCount,
        byStatus,
        pendingOrInProgress,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
