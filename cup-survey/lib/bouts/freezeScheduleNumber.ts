import type { Prisma } from '@prisma/client'
import type { ScheduleExecutionRecord, ScheduledBout } from './scheduleTypes'
import {
  assertBoutCanBeFrozen,
  computeCurrentScheduleNumber,
  formatScheduleDisplayNumber,
  frozenNumberFromExecution,
  isBoutScheduleFrozen,
  resolveNextStartableBoutId,
  type ScheduleQueueEntry,
} from './scheduleDisplayNumber'
import { InvalidScheduleInvariantError } from './errors'

export type FreezeScheduleSnapshot = {
  matsEnabled: boolean
  mats: Array<{ matIndex: number; bouts: ScheduledBout[] }>
  executions: Map<string, ScheduleExecutionRecord>
  skipInvariantChecks?: boolean
}

export type FreezeScheduleNumberResult = {
  formatted: string
  matNumber: number | null
  position: number
  changed: boolean
}

function buildQueues(snapshot: FreezeScheduleSnapshot): ScheduleQueueEntry[][] {
  if (snapshot.matsEnabled) {
    return snapshot.mats.map((mat) =>
      mat.bouts.map((bout) => {
        const execution = snapshot.executions.get(bout.id)
        const frozen = execution ? frozenNumberFromExecution(execution) : null
        return {
          boutId: bout.id,
          matIndex: mat.matIndex,
          isFrozen: frozen != null,
          frozen,
        }
      }),
    )
  }

  const globalBouts = snapshot.mats
    .flatMap((mat) => mat.bouts.map((bout) => ({ bout, matIndex: mat.matIndex })))
    .sort((left, right) => {
      const leftStart = left.bout.timing.estimatedStartAt
      const rightStart = right.bout.timing.estimatedStartAt
      if (leftStart !== rightStart) {
        return leftStart.localeCompare(rightStart)
      }
      if (left.matIndex !== right.matIndex) {
        return left.matIndex - right.matIndex
      }
      return left.bout.id.localeCompare(right.bout.id)
    })

  return [
    globalBouts.map((entry) => {
      const execution = snapshot.executions.get(entry.bout.id)
      const frozen = execution ? frozenNumberFromExecution(execution) : null
      return {
        boutId: entry.bout.id,
        matIndex: entry.matIndex,
        isFrozen: frozen != null,
        frozen,
      }
    }),
  ]
}

export function resolveNextStartableBoutIdForFreeze(
  boutId: string,
  snapshot: FreezeScheduleSnapshot,
): string | null {
  const queues = buildQueues(snapshot)
  if (!snapshot.matsEnabled) {
    return resolveNextStartableBoutId(queues[0] ?? [], snapshot.executions)
  }

  const matQueueIndex = snapshot.mats.findIndex((mat) =>
    mat.bouts.some((bout) => bout.id === boutId),
  )
  if (matQueueIndex < 0) {
    return null
  }

  return resolveNextStartableBoutId(queues[matQueueIndex] ?? [], snapshot.executions)
}

export async function freezeScheduleNumberIfNeeded(
  tx: Prisma.TransactionClient,
  boutId: string,
  snapshot: FreezeScheduleSnapshot,
  options?: { flexibleOrder?: boolean },
): Promise<FreezeScheduleNumberResult> {
  const execution = await tx.boutScheduleExecution.findUnique({ where: { boutId } })
  if (execution?.frozenScheduleFormatted) {
    return {
      formatted: execution.frozenScheduleFormatted,
      matNumber: execution.frozenScheduleMatNumber,
      position: execution.frozenSchedulePosition ?? 0,
      changed: false,
    }
  }

  if (!options?.flexibleOrder) {
    const nextStartableBoutId = resolveNextStartableBoutIdForFreeze(boutId, snapshot)
    assertBoutCanBeFrozen(boutId, nextStartableBoutId)
  }

  const number = computeCurrentScheduleNumber(
    {
      ...snapshot,
      skipInvariantChecks:
        snapshot.skipInvariantChecks === true || options?.flexibleOrder === true,
    },
    boutId,
  )
  const formatted = formatScheduleDisplayNumber(
    number.matNumber,
    number.position,
    snapshot.matsEnabled,
  )
  if (formatted !== number.formatted) {
    throw new InvalidScheduleInvariantError('Schedule number formatting mismatch')
  }

  await tx.boutScheduleExecution.upsert({
    where: { boutId },
    create: {
      boutId,
      frozenScheduleFormatted: formatted,
      frozenScheduleMatNumber: number.matNumber,
      frozenSchedulePosition: number.position,
    },
    update: {
      frozenScheduleFormatted: formatted,
      frozenScheduleMatNumber: number.matNumber,
      frozenSchedulePosition: number.position,
    },
  })

  const updatedExecution = snapshot.executions.get(boutId) ?? {
    boutId,
    actualStartAt: null,
    actualEndAt: null,
  }
  updatedExecution.frozenScheduleFormatted = formatted
  updatedExecution.frozenScheduleMatNumber = number.matNumber
  updatedExecution.frozenSchedulePosition = number.position
  snapshot.executions.set(boutId, updatedExecution)

  return {
    formatted,
    matNumber: number.matNumber,
    position: number.position,
    changed: true,
  }
}

export function assertCompletedBoutHasFrozenNumber(execution: ScheduleExecutionRecord): void {
  const completed = execution.actualEndAt != null
  if (completed && !isBoutScheduleFrozen(execution)) {
    throw new InvalidScheduleInvariantError(
      'Completed bout must have frozen schedule number',
    )
  }
}
