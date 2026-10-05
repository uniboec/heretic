import { prisma } from '../lib/prisma'
import { frozenNumberFromExecution } from '../lib/bouts/scheduleDisplayNumber'
import { buildScheduledMats, loadFullScheduleSnapshot } from '../lib/bouts/scheduleService'

async function main() {
  const matIndex = Number(process.argv[2] ?? 1)
  const fullSnapshot = await prisma.$transaction((tx) =>
    loadFullScheduleSnapshot(tx, { adminPreview: true }),
  )
  const scheduled = buildScheduledMats({
    grouped: fullSnapshot.grouped,
    snapshot: {
      ...fullSnapshot,
      settings: { ...fullSnapshot.settings, scheduleLegacyGap: true },
    },
    now: new Date(),
  })

  const executionById = new Map(fullSnapshot.executions.map((row) => [row.boutId, row]))
  const mat = scheduled.mats.find((m) => m.matIndex === matIndex)
  if (!mat) {
    console.log('Mat not found')
    return
  }

  mat.bouts.forEach((bout, index) => {
    const execution = executionById.get(bout.id)
    const frozen = execution ? frozenNumberFromExecution(execution) : null
    const status = execution?.actualEndAt
      ? 'completed'
      : execution?.actualStartAt
        ? 'in_progress'
        : 'upcoming'
    console.log(
      `[${index}] stage=${bout.competitionStage} frozen=${frozen?.formatted ?? '-'} status=${status} id=${bout.id.slice(-40)}`,
    )
  })
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
