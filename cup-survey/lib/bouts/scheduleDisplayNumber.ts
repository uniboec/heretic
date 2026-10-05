import type { ScheduleExecutionRecord, ScheduledBout } from './scheduleTypes'
import {
  BoutNotNextInScheduleError,
  InvalidScheduleInvariantError,
  ScheduleContiguityConflictError,
  ScheduleNumberConflictError,
} from './errors'
import {
  isBoutExecutionCompleted,
  isBoutExecutionInProgress,
} from './presentation/boutDisplayStatus'

export type ScheduleDisplayNumber = {
  formatted: string
  matNumber: number | null
  position: number
}

export type ScheduleQueueEntry = {
  boutId: string
  matIndex: number
  isFrozen: boolean
  frozen?: ScheduleDisplayNumber | null
}

export function formatScheduleDisplayNumber(
  matNumber: number | null,
  position: number,
  matsEnabled: boolean,
): string {
  if (position < 1) {
    throw new InvalidScheduleInvariantError('schedulePosition must be >= 1')
  }
  if (matsEnabled) {
    if (matNumber == null || matNumber < 1) {
      throw new InvalidScheduleInvariantError('matNumber required when matsEnabled=true')
    }
    return `${matNumber}-${position}`
  }
  return String(position)
}

export function resolveMatId(matIndex: number, matsEnabled: boolean): string | null {
  return matsEnabled ? `mat-${matIndex}` : null
}

export function isBoutScheduleFrozen(execution?: ScheduleExecutionRecord | null): boolean {
  return execution?.frozenScheduleFormatted != null
}

export function frozenNumberFromExecution(
  execution: ScheduleExecutionRecord,
): ScheduleDisplayNumber | null {
  if (!execution.frozenScheduleFormatted) {
    return null
  }
  return {
    formatted: execution.frozenScheduleFormatted,
    matNumber: execution.frozenScheduleMatNumber ?? null,
    position: execution.frozenSchedulePosition ?? 0,
  }
}

export function assertFrozenPrefixInvariant(queue: ScheduleQueueEntry[]): void {
  let seenNonFrozen = false
  for (const entry of queue) {
    if (seenNonFrozen && entry.isFrozen) {
      throw new InvalidScheduleInvariantError('Frozen prefix invariant violated')
    }
    if (!entry.isFrozen) {
      seenNonFrozen = true
    }
  }
}

export function hasFrozenPrefixViolation(input: {
  matsEnabled: boolean
  mats: Array<{ matIndex: number; bouts: ScheduledBout[] }>
  executions: Map<string, ScheduleExecutionRecord>
}): boolean {
  const queues: ScheduleQueueEntry[][] = []

  if (input.matsEnabled) {
    for (const mat of input.mats) {
      const queue: ScheduleQueueEntry[] = []
      for (const bout of mat.bouts) {
        const execution = input.executions.get(bout.id)
        const frozen = frozenNumberFromExecution(
          execution ?? { boutId: bout.id, actualStartAt: null, actualEndAt: null },
        )
        queue.push({
          boutId: bout.id,
          matIndex: mat.matIndex,
          isFrozen: frozen != null,
          frozen,
        })
      }
      queues.push(queue)
    }
  } else {
    const globalBouts = input.mats
      .flatMap((mat) =>
        mat.bouts.map((bout) => ({
          bout,
          matIndex: mat.matIndex,
        })),
      )
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

    const queue: ScheduleQueueEntry[] = []
    for (const entry of globalBouts) {
      const execution = input.executions.get(entry.bout.id)
      const frozen = frozenNumberFromExecution(
        execution ?? { boutId: entry.bout.id, actualStartAt: null, actualEndAt: null },
      )
      queue.push({
        boutId: entry.bout.id,
        matIndex: entry.matIndex,
        isFrozen: frozen != null,
        frozen,
      })
    }
    queues.push(queue)
  }

  for (const queue of queues) {
    try {
      assertFrozenPrefixInvariant(queue)
    } catch (error) {
      if (error instanceof InvalidScheduleInvariantError) {
        return true
      }
      throw error
    }
  }

  return false
}

export function assertScheduleUniqueness(
  numbers: ScheduleDisplayNumber[],
  matsEnabled: boolean,
): void {
  const seen = new Set<string>()
  for (const number of numbers) {
    const key = matsEnabled
      ? `${number.matNumber ?? 'null'}:${number.position}`
      : String(number.position)
    if (seen.has(key)) {
      throw new ScheduleNumberConflictError(`Duplicate schedule number: ${number.formatted}`)
    }
    seen.add(key)
  }
}

export function assertScheduleContiguity(
  numbers: ScheduleDisplayNumber[],
  matsEnabled: boolean,
): void {
  if (numbers.length === 0) {
    return
  }

  if (matsEnabled) {
    const byMat = new Map<number, number[]>()
    for (const number of numbers) {
      if (number.matNumber == null) {
        throw new ScheduleContiguityConflictError('matNumber required for mats mode contiguity')
      }
      const positions = byMat.get(number.matNumber) ?? []
      positions.push(number.position)
      byMat.set(number.matNumber, positions)
    }
    for (const [matNumber, positions] of byMat) {
      const sorted = [...positions].sort((a, b) => a - b)
      for (let index = 0; index < sorted.length; index += 1) {
        if (sorted[index] !== index + 1) {
          throw new ScheduleContiguityConflictError(
            `Non-contiguous positions on mat ${matNumber}`,
          )
        }
      }
    }
    return
  }

  const sorted = [...numbers].map((number) => number.position).sort((a, b) => a - b)
  for (let index = 0; index < sorted.length; index += 1) {
    if (sorted[index] !== index + 1) {
      throw new ScheduleContiguityConflictError('Non-contiguous global schedule positions')
    }
  }
}

export function isStaleLegacyFrozenDisplay(input: {
  frozen: ScheduleDisplayNumber
  matIndex: number
  position: number
  matsEnabled: boolean
}): boolean {
  const matMatches = !input.matsEnabled || input.frozen.matNumber === input.matIndex
  const positionMatches = input.frozen.position === input.position
  return !matMatches || !positionMatches
}

export function buildDynamicScheduleDisplayNumber(input: {
  matIndex: number
  position: number
  matsEnabled: boolean
}): ScheduleDisplayNumber {
  const matNumber = input.matsEnabled ? input.matIndex : null
  return {
    formatted: formatScheduleDisplayNumber(matNumber, input.position, input.matsEnabled),
    matNumber,
    position: input.position,
  }
}

function resolveScheduleDisplayNumber(input: {
  frozen: ScheduleDisplayNumber | null
  matIndex: number
  position: number
  matsEnabled: boolean
  skipInvariantChecks: boolean
}): ScheduleDisplayNumber {
  const dynamic = buildDynamicScheduleDisplayNumber({
    matIndex: input.matIndex,
    position: input.position,
    matsEnabled: input.matsEnabled,
  })

  if (!input.frozen) {
    return dynamic
  }

  if (!input.skipInvariantChecks) {
    return input.frozen
  }

  if (
    !isStaleLegacyFrozenDisplay({
      frozen: input.frozen,
      matIndex: input.matIndex,
      position: input.position,
      matsEnabled: input.matsEnabled,
    })
  ) {
    return input.frozen
  }

  return dynamic
}

export function resolveNextStartableBoutId(
  queue: ScheduleQueueEntry[],
  executions: Map<string, ScheduleExecutionRecord>,
): string | null {
  for (const entry of queue) {
    if (entry.isFrozen) {
      continue
    }
    const execution = executions.get(entry.boutId)
    if (execution && (isBoutExecutionCompleted(execution) || isBoutExecutionInProgress(execution))) {
      continue
    }
    return entry.boutId
  }
  return null
}

export function assertBoutCanBeFrozen(
  requestedBoutId: string,
  nextStartableBoutId: string | null,
): void {
  if (!nextStartableBoutId || requestedBoutId !== nextStartableBoutId) {
    throw new BoutNotNextInScheduleError()
  }
}

export function computeScheduleDisplayNumbers(input: {
  matsEnabled: boolean
  mats: Array<{ matIndex: number; bouts: ScheduledBout[] }>
  executions: Map<string, ScheduleExecutionRecord>
  skipInvariantChecks?: boolean
}): Map<
  string,
  {
    scheduleDisplayNumber: string
    schedulePosition: number
    matId: string | null
    matNumber: number | null
    isFrozen: boolean
    isInEditableZone: boolean
    isNextStartable: boolean
  }
> {
  const result = new Map<
    string,
    {
      scheduleDisplayNumber: string
      schedulePosition: number
      matId: string | null
      matNumber: number | null
      isFrozen: boolean
      isInEditableZone: boolean
      isNextStartable: boolean
    }
  >()

  const queues: ScheduleQueueEntry[][] = []

  if (input.matsEnabled) {
    for (const mat of input.mats) {
      const queue: ScheduleQueueEntry[] = []
      let position = 0
      for (const bout of mat.bouts) {
        position += 1
        const execution = input.executions.get(bout.id)
        const frozen = frozenNumberFromExecution(execution ?? { boutId: bout.id, actualStartAt: null, actualEndAt: null })
        const isFrozen = frozen != null
        queue.push({
          boutId: bout.id,
          matIndex: mat.matIndex,
          isFrozen,
          frozen,
        })

        const displayNumber = resolveScheduleDisplayNumber({
          frozen,
          matIndex: mat.matIndex,
          position,
          matsEnabled: true,
          skipInvariantChecks: input.skipInvariantChecks === true,
        })

        result.set(bout.id, {
          scheduleDisplayNumber: displayNumber.formatted,
          schedulePosition: displayNumber.position,
          matId: resolveMatId(mat.matIndex, true),
          matNumber: displayNumber.matNumber,
          isFrozen,
          isInEditableZone: false,
          isNextStartable: false,
        })
      }
      queues.push(queue)
      if (!input.skipInvariantChecks) {
        assertFrozenPrefixInvariant(queue)
      }
    }
  } else {
    const globalBouts = input.mats
      .flatMap((mat) =>
        mat.bouts.map((bout) => ({
          bout,
          matIndex: mat.matIndex,
        })),
      )
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

    const queue: ScheduleQueueEntry[] = []
    let position = 0
    for (const entry of globalBouts) {
      position += 1
      const execution = input.executions.get(entry.bout.id)
      const frozen = frozenNumberFromExecution(
        execution ?? { boutId: entry.bout.id, actualStartAt: null, actualEndAt: null },
      )
      const isFrozen = frozen != null
      queue.push({
        boutId: entry.bout.id,
        matIndex: entry.matIndex,
        isFrozen,
        frozen,
      })

      const displayNumber = resolveScheduleDisplayNumber({
        frozen,
        matIndex: entry.matIndex,
        position,
        matsEnabled: false,
        skipInvariantChecks: input.skipInvariantChecks === true,
      })

      result.set(entry.bout.id, {
        scheduleDisplayNumber: displayNumber.formatted,
        schedulePosition: displayNumber.position,
        matId: null,
        matNumber: null,
        isFrozen,
        isInEditableZone: false,
        isNextStartable: false,
      })
    }
    queues.push(queue)
    if (!input.skipInvariantChecks) {
      assertFrozenPrefixInvariant(queue)
    }
  }

  const allNumbers: ScheduleDisplayNumber[] = []
  for (const meta of result.values()) {
    allNumbers.push({
      formatted: meta.scheduleDisplayNumber,
      matNumber: meta.matNumber,
      position: meta.schedulePosition,
    })
  }
  if (!input.skipInvariantChecks) {
    assertScheduleUniqueness(allNumbers, input.matsEnabled)
    assertScheduleContiguity(allNumbers, input.matsEnabled)
  }

  for (const queue of queues) {
    const nextStartableBoutId = resolveNextStartableBoutId(queue, input.executions)
    let frozenPrefixEnded = false
    for (const entry of queue) {
      const meta = result.get(entry.boutId)
      if (!meta) continue
      if (!entry.isFrozen) {
        frozenPrefixEnded = true
      }
      meta.isInEditableZone = frozenPrefixEnded && !entry.isFrozen
      meta.isNextStartable = entry.boutId === nextStartableBoutId
    }
  }

  return result
}

export function computeCurrentScheduleNumber(
  input: {
    matsEnabled: boolean
    mats: Array<{ matIndex: number; bouts: ScheduledBout[] }>
    executions: Map<string, ScheduleExecutionRecord>
    skipInvariantChecks?: boolean
  },
  boutId: string,
): ScheduleDisplayNumber {
  const map = computeScheduleDisplayNumbers(input)
  const meta = map.get(boutId)
  if (!meta) {
    throw new InvalidScheduleInvariantError(`Bout ${boutId} not found in schedule`)
  }
  return {
    formatted: meta.scheduleDisplayNumber,
    matNumber: meta.matNumber,
    position: meta.schedulePosition,
  }
}
