#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'

async function main() {
  for (const num of ['2-4', '2-14']) {
    const ex = await prisma.boutScheduleExecution.findMany({
      where: { frozenScheduleFormatted: num },
      select: { boutId: true, boutPhase: true, frozenScheduleFormatted: true },
    })
    console.log(num, JSON.stringify(ex))
  }
}

main().finally(async () => prisma.$disconnect())
