import {
  MAX_BOUT_PERIOD_DURATION_MS,
  MIN_BOUT_PERIOD_DURATION_MS,
} from './parseBoutDurationInput'
import { mergeLiveSnapshot, type BoutPeriodCount } from './boutLiveSnapshot'
import { CommandNotAllowedError } from './mat-control/errors'
import { computeClockElapsedMs, stopClockAt } from './stopClockAt'
import type { BoutPeriod, MatControlExecution } from './mat-control/types'

export type BoutTimingSettingsPayload = {
  mainDurationMs?: number
  extraDurationMs?: number
  periodCount?: BoutPeriodCount
}

function assertDurationMs(value: number, label: string): void {
  if (!Number.isFinite(value) || value < MIN_BOUT_PERIOD_DURATION_MS || value > MAX_BOUT_PERIOD_DURATION_MS) {
    throw new CommandNotAllowedError(`${label} вне допустимого диапазона`)
  }
}

function clampClockToDuration(
  execution: MatControlExecution,
  now: Date,
  periodDurationMs: number,
): MatControlExecution {
  const elapsed = computeClockElapsedMs(execution, now)
  if (elapsed <= periodDurationMs) {
    return execution
  }

  let next = execution.clockState === 'running' ? stopClockAt(execution, now) : execution
  return {
    ...next,
    clockElapsedBeforeStartMs: Math.min(next.clockElapsedBeforeStartMs, periodDurationMs),
  }
}

export function applyBoutTimingSettings(input: {
  execution: MatControlExecution
  payload: BoutTimingSettingsPayload
  now: Date
}): MatControlExecution {
  const { payload } = input

  if (payload.mainDurationMs != null) {
    assertDurationMs(payload.mainDurationMs, 'Длительность основного раунда')
  }
  if (payload.extraDurationMs != null) {
    assertDurationMs(payload.extraDurationMs, 'Длительность доп. раунда')
  }
  if (payload.periodCount != null && payload.periodCount !== 1 && payload.periodCount !== 2) {
    throw new CommandNotAllowedError('Количество раундов должно быть 1 или 2')
  }
  if (payload.periodCount === 1 && input.execution.currentPeriod === 'extra') {
    throw new CommandNotAllowedError('Нельзя отключить доп. раунд во время доп. времени')
  }

  const snapshotPatch: {
    periodDurationMs?: { main?: number; extra?: number }
    periodCount?: BoutPeriodCount
  } = {}

  if (payload.mainDurationMs != null || payload.extraDurationMs != null) {
    snapshotPatch.periodDurationMs = {}
    if (payload.mainDurationMs != null) {
      snapshotPatch.periodDurationMs.main = payload.mainDurationMs
    }
    if (payload.extraDurationMs != null) {
      snapshotPatch.periodDurationMs.extra = payload.extraDurationMs
    }
  }
  if (payload.periodCount != null) {
    snapshotPatch.periodCount = payload.periodCount
  }

  let execution: MatControlExecution = {
    ...input.execution,
    liveSnapshot: mergeLiveSnapshot(input.execution.liveSnapshot, snapshotPatch),
  }

  const durationByPeriod: Partial<Record<BoutPeriod, number>> = {}
  if (payload.mainDurationMs != null) {
    durationByPeriod.main = payload.mainDurationMs
  }
  if (payload.extraDurationMs != null) {
    durationByPeriod.extra = payload.extraDurationMs
  }

  const currentDuration = durationByPeriod[execution.currentPeriod]
  if (currentDuration != null) {
    execution = clampClockToDuration(execution, input.now, currentDuration)
  }

  return execution
}
