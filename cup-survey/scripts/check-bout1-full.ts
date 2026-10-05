import { prisma } from '../lib/prisma'

const boutId = 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_52::bout-1'

async function main() {
  const row = await prisma.boutScheduleExecution.findUnique({ where: { boutId } })
  console.log(JSON.stringify(row, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
