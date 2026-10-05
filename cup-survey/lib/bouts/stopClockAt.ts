import type { BoutEventRecord, MatControlExecution } from './mat-control/types'

type ClockTimingFields = Pick<
  MatControlExecution,
  'clockState' | 'clockStartedAt' | 'clockElapsedBeforeStartMs'
>

/** API/JSON snapshots may deliver ISO strings instead of Date instances. */
export function coerceClockStartedAt(
  value: Date | string | null | undefined,
): Date | null {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null
  }
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

/** Elapsed fight-clock time at `at`, including the active running segment. */
export function computeClockElapsedMs(execution: ClockTimingFields, at: Date): number {
  const clockStartedAt = coerceClockStartedAt(execution.clockStartedAt)
  if (execution.clockState === 'running' && clockStartedAt) {
    return (
      execution.clockElapsedBeforeStartMs +
      (at.getTime() - clockStartedAt.getTime())
    )
  }
  return execution.clockElapsedBeforeStartMs
}

export function stopClockAt(execution: MatControlExecution, at: Date): MatControlExecution {
  let clockElapsedBeforeStartMs = execution.clockElapsedBeforeStartMs
  let clockStartedAt = execution.clockStartedAt

  const runningStartedAt = coerceClockStartedAt(execution.clockStartedAt)
  if (execution.clockState === 'running' && runningStartedAt) {
    clockElapsedBeforeStartMs += at.getTime() - runningStartedAt.getTime()
    clockStartedAt = null
  }

  return {
    ...execution,
    clockElapsedBeforeStartMs,
    clockStartedAt,
    clockState: 'stopped',
  }
}

export function startClockAt(execution: MatControlExecution, at: Date): MatControlExecution {
  return {
    ...execution,
    clockState: 'running',
    clockStartedAt: at,
  }
}

export function computeRemainingMs(
  execution: ClockTimingFields,
  periodDurationMs: number,
  now: Date,
): number {
  const clockStartedAt = coerceClockStartedAt(execution.clockStartedAt)
  if (execution.clockState === 'running' && clockStartedAt) {
    const elapsed =
      execution.clockElapsedBeforeStartMs + (now.getTime() - clockStartedAt.getTime())
    return Math.max(0, periodDurationMs - elapsed)
  }
  return Math.max(0, periodDurationMs - execution.clockElapsedBeforeStartMs)
}

export function computePeriodDeadlineAt(
  execution: ClockTimingFields,
  periodDurationMs: number,
): Date | null {
  const clockStartedAt = coerceClockStartedAt(execution.clockStartedAt)
  if (execution.clockState === 'running' && clockStartedAt) {
    return new Date(
      clockStartedAt.getTime() +
        (periodDurationMs - execution.clockElapsedBeforeStartMs),
    )
  }
  return null
}

export function adjustClockElapsed(
  execution: MatControlExecution,
  deltaMs: number,
  periodDurationMs: number,
): MatControlExecution {
  const nextElapsed = Math.min(
    periodDurationMs,
    Math.max(0, execution.clockElapsedBeforeStartMs - deltaMs),
  )
  return {
    ...execution,
    clockElapsedBeforeStartMs: nextElapsed,
  }
}

/** Reverses undone CLOCK_ADJUST events so execution clock matches the active event log. */
export function revertUndoneClockAdjusts(input: {
  execution: MatControlExecution
  undoneTargets: BoutEventRecord[]
  periodDurationMs: number
}): MatControlExecution {
  let execution = input.execution
  for (const event of input.undoneTargets) {
    if (event.eventType !== 'CLOCK_ADJUST') continue
    const payload = event.payload as { deltaMs?: number } | null
    const deltaMs = payload?.deltaMs ?? 0
    execution = adjustClockElapsed(execution, -deltaMs, input.periodDurationMs)
  }
  return execution
}
