import { prisma } from '../lib/prisma'
import {
  frozenNumberFromExecution,
  type ScheduleQueueEntry,
} from '../lib/bouts/scheduleDisplayNumber'
import { buildScheduledMats, loadFullScheduleSnapshot } from '../lib/bouts/scheduleService'
import { isBoutExecutionCompleted } from '../lib/bouts/presentation/boutDisplayStatus'

async function main() {
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

  for (const mat of scheduled.mats) {
    const queue: ScheduleQueueEntry[] = mat.bouts.map((bout) => {
      const execution = executionById.get(bout.id)
      const frozen = execution ? frozenNumberFromExecution(execution) : null
      return {
        boutId: bout.id,
        matIndex: mat.matIndex,
        isFrozen: frozen != null,
        frozen,
      }
    })

    let seenNonFrozen = false
    const violations: Array<{ index: number; boutId: string; frozen: string | null; status: string }> =
      []

    mat.bouts.forEach((bout, index) => {
      const entry = queue[index]!
      const execution = executionById.get(bout.id)
      const status = execution?.actualEndAt
        ? 'completed'
        : execution?.actualStartAt
          ? 'in_progress'
          : 'upcoming'
      if (seenNonFrozen && entry.isFrozen) {
        violations.push({
          index,
          boutId: bout.id,
          frozen: entry.frozen?.formatted ?? null,
          status,
        })
      }
      if (!entry.isFrozen) {
        seenNonFrozen = true
      }
    })

    if (violations.length > 0) {
      console.log(`\nMat ${mat.matIndex} violations: ${violations.length}`)
      for (const v of violations.slice(0, 8)) {
        console.log(`  [${v.index}] ${v.boutId} frozen=${v.frozen} status=${v.status}`)
      }
    } else {
      console.log(`Mat ${mat.matIndex}: OK (${mat.bouts.length} bouts)`)
    }
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
