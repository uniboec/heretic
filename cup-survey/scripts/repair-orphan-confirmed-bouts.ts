import { prisma } from '../lib/prisma'

async function main() {
  const rows = await prisma.boutScheduleExecution.findMany({
    where: {
      boutPhase: 'confirmed',
      actualStartAt: null,
      actualEndAt: { not: null },
    },
    select: {
      boutId: true,
      officialStartedAt: true,
      officialEndedAt: true,
      actualEndAt: true,
    },
  })

  if (rows.length === 0) {
    console.log('No orphan confirmed bouts to repair.')
    return
  }

  for (const row of rows) {
    const actualStartAt = row.officialStartedAt ?? row.officialEndedAt ?? row.actualEndAt
    await prisma.boutScheduleExecution.update({
      where: { boutId: row.boutId },
      data: { actualStartAt },
    })
    console.log(`Repaired ${row.boutId} -> actualStartAt=${actualStartAt?.toISOString()}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
