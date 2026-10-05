import { prisma } from '../lib/prisma'
import { wasFightClockStarted } from '../lib/fastestFights/fightClockStarted'

async function main() {
  const results = await prisma.boutResult.findMany({
    where: { isCurrent: true, resultStatus: 'ACTIVE' },
    select: { id: true, boutId: true, fightOfficiallyStarted: true },
  })

  let updated = 0
  for (const result of results) {
    const events = await prisma.boutEvent.findMany({
      where: { boutId: result.boutId },
      orderBy: { createdAt: 'asc' },
    })
    const started = wasFightClockStarted(
      events.map((event) => ({
        eventType: event.eventType,
        undoneAt: event.undoneAt,
      })),
    )
    if (started !== result.fightOfficiallyStarted) {
      await prisma.boutResult.update({
        where: { id: result.id },
        data: { fightOfficiallyStarted: started },
      })
      updated += 1
    }
  }

  console.log(`Backfilled fightOfficiallyStarted for ${updated} bout results.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
