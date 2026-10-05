import { prisma } from '../lib/prisma'

async function main() {
  const queues = await prisma.awardCeremonyQueue.findMany({
    select: { categoryKey: true, status: true },
    orderBy: { categoryKey: 'asc' },
  })
  console.log('award queues:', queues.length)
  for (const queue of queues) {
    console.log(`${queue.categoryKey} (${queue.status})`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
