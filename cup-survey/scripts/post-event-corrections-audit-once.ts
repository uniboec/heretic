#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'

import { prisma } from '../lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'

async function main() {
  const corrections = await prisma.resultCorrectionCase.findMany({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      sourceBoutId: true,
      operationId: true,
      reason: true,
      createdAt: true,
      appliedAt: true,
      status: true,
    },
  })

  const awardInProgress = await prisma.awardCeremonyQueue.findMany({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID, status: 'IN_PROGRESS' },
    select: { categoryKey: true, status: true, updatedAt: true },
  })

  const resultVersions = await prisma.boutResult.groupBy({
    by: ['boutId'],
    _count: { resultVersion: true },
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID, isCurrent: true },
  })
  const multiVersionBouts = resultVersions.filter((row) => row._count.resultVersion > 0)
  const totalVersions = await prisma.boutResult.count({
    where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
  })
  const nonActiveCurrent = await prisma.boutResult.findMany({
    where: {
      tournamentScopeId: TOURNAMENT_SCOPE_ID,
      isCurrent: true,
      resultStatus: { not: 'ACTIVE' },
    },
    select: { boutId: true, resultStatus: true, resultVersion: true },
  })

  const legacyGap = await prisma.boutsPageSetting.findUnique({
    where: { id: 'default' },
    select: { scheduleLegacyGap: true, scheduleVersion: true, updatedAt: true },
  })

  console.log(
    JSON.stringify(
      {
        corrections: {
          count: corrections.length,
          items: corrections,
        },
        awardInProgress,
        boutResults: {
          currentCount: resultVersions.length,
          totalVersions,
          nonActiveCurrent,
        },
        schedule: legacyGap,
      },
      null,
      2,
    ),
  )
}

main().finally(async () => prisma.$disconnect())
