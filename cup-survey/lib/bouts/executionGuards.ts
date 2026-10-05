import type { Prisma } from '@prisma/client'
import type { InternalBout } from './types'
import type { ScheduleExecutionRecord, ScheduledBout } from './scheduleTypes'
import { BoutsScheduleCorruptError } from './errors'

export function hasExecutionHistory(execution: ScheduleExecutionRecord): boolean {
  return execution.actualStartAt != null || execution.actualEndAt != null
}

/** Drops impossible end timestamps that would break mat ordering (END_WITHOUT_START). */
export function normalizeScheduleExecution(
  execution: ScheduleExecutionRecord,
): ScheduleExecutionRecord {
  if (execution.actualEndAt != null && execution.actualStartAt == null) {
    return {
      ...execution,
      actualStartAt: null,
      actualEndAt: null,
      frozenScheduleFormatted: execution.frozenScheduleFormatted ?? null,
      frozenScheduleMatNumber: execution.frozenScheduleMatNumber ?? null,
      frozenSchedulePosition: execution.frozenSchedulePosition ?? null,
    }
  }
  return execution
}

export function isEmptyExecution(execution: ScheduleExecutionRecord): boolean {
  return execution.actualStartAt == null && execution.actualEndAt == null
}

/** Removes empty execution rows before the first global START — write tx only. */
export async function cleanupEmptyExecutionsIfNotStarted(
  tx: Prisma.TransactionClient,
  executions: ScheduleExecutionRecord[],
): Promise<number> {
  if (tournamentHasStarted(executions)) {
    return 0
  }

  const emptyBoutIds = executions.filter(isEmptyExecution).map((execution) => execution.boutId)
  if (emptyBoutIds.length === 0) {
    return 0
  }

  const result = await tx.boutScheduleExecution.deleteMany({
    where: {
      boutId: { in: emptyBoutIds },
      actualStartAt: null,
      actualEndAt: null,
    },
  })

  return result.count
}

export function assertNoOrphanExecutions(input: {
  scheduleBoutIds: string[]
  executions: ScheduleExecutionRecord[]
}): void {
  const scheduleCounts = new Map<string, number>()
  for (const boutId of input.scheduleBoutIds) {
    scheduleCounts.set(boutId, (scheduleCounts.get(boutId) ?? 0) + 1)
  }

  for (const execution of input.executions) {
    if (!hasExecutionHistory(execution)) continue
    const count = scheduleCounts.get(execution.boutId) ?? 0
    if (count !== 1) {
      throw new BoutsScheduleCorruptError('STARTED_EXECUTION_ORPHAN')
    }
  }
}

export function collectScheduleBoutIds(mats: Array<{ bouts: InternalBout[] }>): string[] {
  return mats.flatMap((mat) => mat.bouts.map((bout) => bout.id))
}

export function tournamentHasStarted(executions: ScheduleExecutionRecord[]): boolean {
  return executions.some((execution) => execution.actualStartAt != null)
}

export function matHasStartedHistory(input: {
  matIndex: number
  bouts: InternalBout[]
  executions: Map<string, ScheduleExecutionRecord>
}): boolean {
  for (const bout of input.bouts) {
    const execution = input.executions.get(bout.id)
    if (execution && hasExecutionHistory(execution)) {
      return true
    }
  }
  return false
}

export function startedMatIndexes(input: {
  mats: Array<{ matIndex: number; bouts: InternalBout[] }>
  executions: Map<string, ScheduleExecutionRecord>
}): number[] {
  const started: number[] = []
  for (const mat of input.mats) {
    if (
      matHasStartedHistory({
        matIndex: mat.matIndex,
        bouts: mat.bouts,
        executions: input.executions,
      })
    ) {
      started.push(mat.matIndex)
    }
  }
  return started
}

export function deepEqualJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
