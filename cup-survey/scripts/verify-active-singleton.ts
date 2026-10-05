import { prisma } from '../lib/prisma'

async function main() {
  const rows = await prisma.bracketGeneration.findMany({
    select: { id: true, status: true, singletonKey: true, version: true },
  })
  const activeLive = rows.filter((row) => row.status === 'ACTIVE' && row.singletonKey === 'live')
  console.log(JSON.stringify({ total: rows.length, activeLiveCount: activeLive.length, rows }, null, 2))
  if (activeLive.length !== 1) {
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
