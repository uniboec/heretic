import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const settings = await prisma.announcerSetting.findFirst()
  const rules = await prisma.announcerRule.findMany({
    select: { eventType: true, enabled: true, priority: true },
    orderBy: { priority: 'desc' },
  })
  const events = await prisma.announcerEvent.groupBy({ by: ['status'], _count: true })
  const recentEvents = await prisma.announcerEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, type: true, status: true, textSnapshot: true, createdAt: true, failureReason: true },
  })
  const positions = await prisma.announcerPositionState.findMany()
  const awardQueue = await prisma.awardCeremonyQueue.findMany({
    select: { id: true, categoryKey: true, status: true },
    take: 10,
  })
  const boutsSettings = await prisma.boutsPageSetting.findUnique({ where: { id: 'default' } })
  const matSessions = await prisma.matControlSession.findMany()
  const boutExecutions = await prisma.boutScheduleExecution.count()
  const resultCount = await prisma.boutResult.count({ where: { isCurrent: true } })

  console.log(
    JSON.stringify(
      {
        settings,
        rules,
        events,
        recentEvents,
        positions,
        awardQueue,
        matCount: boutsSettings?.matCount,
        matSessions,
        boutExecutions,
        resultCount,
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
  .finally(() => prisma.$disconnect())
