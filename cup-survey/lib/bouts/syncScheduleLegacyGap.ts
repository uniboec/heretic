import type { Prisma } from '@prisma/client'
import { hasFrozenPrefixViolation } from './scheduleDisplayNumber'
import { buildScheduledMats, loadFullScheduleSnapshot } from './scheduleService'
import type { ScheduleExecutionRecord } from './scheduleTypes'

export async function syncScheduleLegacyGapIfNeeded(
  tx: Prisma.TransactionClient,
): Promise<boolean> {
  const settings = await tx.boutsPageSetting.findUniqueOrThrow({
    where: { id: 'default' },
  })
  if (settings.scheduleLegacyGap) {
    return false
  }

  const fullSnapshot = await loadFullScheduleSnapshot(tx, { adminPreview: true })
  const scheduled = buildScheduledMats({
    grouped: fullSnapshot.grouped,
    snapshot: {
      ...fullSnapshot,
      settings: {
        ...fullSnapshot.settings,
        scheduleLegacyGap: true,
      },
    },
    now: new Date(),
  })

  const executionRows = await tx.boutScheduleExecution.findMany({
    select: {
      boutId: true,
      actualStartAt: true,
      actualEndAt: true,
      frozenScheduleFormatted: true,
      frozenScheduleMatNumber: true,
      frozenSchedulePosition: true,
    },
  })
  const executions = new Map<string, ScheduleExecutionRecord>(
    executionRows.map((row) => [
      row.boutId,
      {
        boutId: row.boutId,
        actualStartAt: row.actualStartAt,
        actualEndAt: row.actualEndAt,
        frozenScheduleFormatted: row.frozenScheduleFormatted,
        frozenScheduleMatNumber: row.frozenScheduleMatNumber,
        frozenSchedulePosition: row.frozenSchedulePosition,
      },
    ]),
  )

  if (
    !hasFrozenPrefixViolation({
      matsEnabled: fullSnapshot.settings.matsEnabled,
      mats: scheduled.mats,
      executions,
    })
  ) {
    return false
  }

  await tx.boutsPageSetting.update({
    where: { id: 'default' },
    data: { scheduleLegacyGap: true },
  })
  return true
}
