import { prisma } from '../lib/prisma'
import { resolveBoutDurationMinutes } from '../lib/bouts/boutDuration'
import { parseLiveSnapshot, resolvePeriodCount, resolvePeriodDurationMs } from '../lib/bouts/boutLiveSnapshot'
import { normalizeBoutsPageSettings } from '../lib/bouts/normalizeBoutsPageSettings'

async function main() {
  const settingsRow = await prisma.boutsPageSetting.findFirst()
  const settings = normalizeBoutsPageSettings(settingsRow ?? {})
  const overrides = settings.ageDivisionDurationOverrides

  console.log('=== Bouts page settings ===')
  console.log(JSON.stringify({
    boutBreakMinutes: settings.boutBreakMinutes,
    ageDivisionDurationOverrides: overrides,
  }, null, 2))

  const executions = await prisma.boutScheduleExecution.findMany({
    where: {
      OR: [
        { boutPhase: { in: ['scheduled', 'live', 'pending_confirmation', 'pending_activity_decision'] } },
        { liveSnapshot: { not: null } },
      ],
    },
    select: {
      boutId: true,
      boutPhase: true,
      liveSnapshot: true,
      clockElapsedBeforeStartMs: true,
    },
    take: 50,
    orderBy: { updatedAt: 'desc' },
  })

  const boutIds = executions.map((row) => row.boutId)
  const draws = await prisma.competitionDraw.findMany({
    where: { boutId: { in: boutIds } },
    select: { boutId: true, categoryKey: true },
  })
  const categoryByBoutId = new Map(draws.map((row) => [row.boutId, row.categoryKey]))

  console.log('\n=== Recent executions with timing snapshot ===')
  for (const row of executions) {
    const categoryKey = categoryByBoutId.get(row.boutId)
    if (!categoryKey) continue

    const scheduleMinutes = resolveBoutDurationMinutes({ categoryKey, overrides })
    const snapshot = parseLiveSnapshot(row.liveSnapshot)
    const mainMs = resolvePeriodDurationMs({
      liveSnapshot: row.liveSnapshot,
      period: 'main',
      categoryKey,
      overrides,
    })
    const extraMs = resolvePeriodDurationMs({
      liveSnapshot: row.liveSnapshot,
      period: 'extra',
      categoryKey,
      overrides,
    })
    const periodCount = resolvePeriodCount(row.liveSnapshot)

    const deltaMainSec = mainMs / 1000 - scheduleMinutes * 60
    if (Math.abs(deltaMainSec) > 0 || snapshot.periodDurationMs || snapshot.periodCount) {
      console.log(JSON.stringify({
        boutId: row.boutId,
        boutPhase: row.boutPhase,
        categoryKey,
        scheduleMinutes,
        mainPeriodSec: mainMs / 1000,
        extraPeriodSec: extraMs / 1000,
        periodCount,
        deltaMainSec,
        liveSnapshot: snapshot,
        clockElapsedBeforeStartMs: row.clockElapsedBeforeStartMs,
      }))
    }
  }

  const withOverrides = executions.filter((row) => {
    const snapshot = parseLiveSnapshot(row.liveSnapshot)
    return Boolean(snapshot.periodDurationMs?.main || snapshot.periodDurationMs?.extra || snapshot.periodCount)
  })
  console.log(`\nExecutions with liveSnapshot timing overrides: ${withOverrides.length}/${executions.length}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
