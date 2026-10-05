import { PrismaClient } from '@prisma/client'
import { seedPresetClubs } from '../lib/registration/clubs'

const prisma = new PrismaClient()

async function main() {
  const { created, total } = await seedPresetClubs()
  console.log(`Clubs: ${created} added, ${total - created} already existed (${total} total in catalog)`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
