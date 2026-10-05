import {
  frozenNumberFromExecution,
  resolveNextStartableBoutId,
  type ScheduleQueueEntry,
} from './scheduleDisplayNumber'
import type { InternalBout } from './types'
import type { ScheduleExecutionRecord, ScheduledBout } from './scheduleTypes'

function buildRuntimeQueue(
  orderedBoutIds: string[],
  matIndex: number,
  executions: Map<string, ScheduleExecutionRecord>,
): ScheduleQueueEntry[] {
  return orderedBoutIds.map((boutId) => {
    const execution = executions.get(boutId)
    const frozen = execution ? frozenNumberFromExecution(execution) : null
    return {
      boutId,
      matIndex,
      isFrozen: frozen != null,
      frozen,
    }
  })
}

export function resolveRuntimeNextStartableBoutId(
  orderedBoutIds: string[],
  matIndex: number,
  executions: Map<string, ScheduleExecutionRecord>,
): string | null {
  if (orderedBoutIds.length === 0) return null
  return resolveNextStartableBoutId(
    buildRuntimeQueue(orderedBoutIds, matIndex, executions),
    executions,
  )
}

export function applyRuntimeNextStartableFlags<T extends Pick<InternalBout, 'id' | 'isNextStartable'>>(
  orderedBouts: T[],
  matIndex: number,
  executions: Map<string, ScheduleExecutionRecord>,
): T[] {
  const nextId = resolveRuntimeNextStartableBoutId(
    orderedBouts.map((bout) => bout.id),
    matIndex,
    executions,
  )
  return orderedBouts.map((bout) => ({
    ...bout,
    isNextStartable: bout.id === nextId,
  }))
}

export function reorderScheduledBoutsByRuntimeOrder(
  scheduledBouts: ScheduledBout[],
  runtimeBouts: InternalBout[],
): ScheduledBout[] {
  const byId = new Map(scheduledBouts.map((bout) => [bout.id, bout]))
  const ordered: ScheduledBout[] = []
  for (const runtimeBout of runtimeBouts) {
    const scheduled = byId.get(runtimeBout.id)
    if (scheduled) {
      ordered.push(scheduled)
    }
  }
  for (const bout of scheduledBouts) {
    if (!ordered.some((entry) => entry.id === bout.id)) {
      ordered.push(bout)
    }
  }
  return ordered
}
