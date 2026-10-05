import type { Prisma } from '@prisma/client'
import { BoutsSchedulerError } from './errors'
import { hasExecutionHistory } from './executionGuards'
import type { ScheduleExecutionRecord } from './scheduleTypes'

export class BoutIdStabilityViolationError extends BoutsSchedulerError {
  constructor(message = 'Нельзя изменить идентификаторы поединков после начала проведения') {
    super('BOUT_ID_STABILITY_VIOLATION', message)
    this.name = 'BoutIdStabilityViolationError'
  }
}

export function assertCategoryBoutIdsStable(input: {
  previousBoutIds: string[]
  nextBoutIds: string[]
  executions: ScheduleExecutionRecord[]
}): void {
  const executionByBoutId = new Map(input.executions.map((row) => [row.boutId, row]))
  const nextSet = new Set(input.nextBoutIds)

  for (const previousBoutId of input.previousBoutIds) {
    const execution = executionByBoutId.get(previousBoutId)
    if (!execution || !hasExecutionHistory(execution)) {
      continue
    }
    if (!nextSet.has(previousBoutId)) {
      throw new BoutIdStabilityViolationError(
        `Поединок ${previousBoutId} уже начат и не может быть пересоздан`,
      )
    }
  }
}

export async function loadExecutionsForBoutIds(
  tx: Prisma.TransactionClient,
  boutIds: string[],
): Promise<ScheduleExecutionRecord[]> {
  if (boutIds.length === 0) {
    return []
  }
  const rows = await tx.boutScheduleExecution.findMany({
    where: { boutId: { in: boutIds } },
  })
  return rows.map((row) => ({
    boutId: row.boutId,
    actualStartAt: row.actualStartAt,
    actualEndAt: row.actualEndAt,
    boutPhase: row.boutPhase,
    clockStartedAt: row.clockStartedAt,
    officialStartedAt: row.officialStartedAt,
    frozenScheduleFormatted: row.frozenScheduleFormatted,
    frozenScheduleMatNumber: row.frozenScheduleMatNumber,
    frozenSchedulePosition: row.frozenSchedulePosition,
  }))
}
