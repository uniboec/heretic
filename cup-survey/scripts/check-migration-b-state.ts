import { prisma } from '../lib/prisma'

async function main() {
  const enums = await prisma.$queryRaw<Array<{ typname: string }>>`
    SELECT typname FROM pg_type
    WHERE typname LIKE 'BracketGenerationStatus%'
    ORDER BY typname
  `
  const gens = await prisma.$queryRaw`
    SELECT id, status::text AS status, "singletonKey" FROM "BracketGeneration"
  `
  console.log(JSON.stringify({ enums, gens }, null, 2))
}

main()
  .finally(() => prisma.$disconnect())
