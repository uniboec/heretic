import { prisma } from '../lib/prisma'

const a = await prisma.athlete.findFirst({
  where: { lastName: { equals: 'Мавликаев', mode: 'insensitive' } },
  include: { entries: true, registration: { select: { publicNumber: true } } },
})
console.log(JSON.stringify(a, (_, v) => (v instanceof Date ? v.toISOString() : v), 2))
await prisma.$disconnect()
