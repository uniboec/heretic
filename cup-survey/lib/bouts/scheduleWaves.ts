import type { ScheduledBoutPlan } from './scheduleTypes'
import type { BoutScheduleWaves } from './boutScheduleWaves'

export type BoutWaveLifecycleState =
  | 'PENDING'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'CANCELLED'
  | 'MOVED'

export type BoutWaveState = {
  boutId: string
  scheduleWave: number
  lifecycle: BoutWaveLifecycleState
}

export function assignScheduleWavesFromPlans(
  plansByMat: Map<number, ScheduledBoutPlan[]>,
): BoutScheduleWaves {
  const allPlans = [...plansByMat.values()].flat()
  allPlans.sort((a, b) => a.plannedStartAt.getTime() - b.plannedStartAt.getTime())

  const waves: BoutScheduleWaves = {}
  let currentWave = 0
  let waveAnchorTimeMs: number | null = null

  for (const plan of allPlans) {
    const startMs = plan.plannedStartAt.getTime()
    if (waveAnchorTimeMs === null) {
      currentWave = 1
      waveAnchorTimeMs = startMs
    } else if (startMs > waveAnchorTimeMs) {
      currentWave += 1
      waveAnchorTimeMs = startMs
    }
    waves[plan.bout.id] = currentWave
    plan.scheduleWave = currentWave
  }

  return waves
}

export function resolveWaveForPlannedStart(
  plannedStartAt: Date,
  state: { currentWave: number; waveAnchorTimeMs: number | null },
): { wave: number; nextState: { currentWave: number; waveAnchorTimeMs: number | null } } {
  const startMs = plannedStartAt.getTime()
  if (state.waveAnchorTimeMs === null) {
    return { wave: 1, nextState: { currentWave: 1, waveAnchorTimeMs: startMs } }
  }
  if (startMs > state.waveAnchorTimeMs) {
    const nextWave = state.currentWave + 1
    return { wave: nextWave, nextState: { currentWave: nextWave, waveAnchorTimeMs: startMs } }
  }
  return { wave: state.currentWave, nextState: state }
}

export function isWavePassed(
  wave: number,
  boutStates: BoutWaveState[],
): boolean {
  const inWave = boutStates.filter((entry) => entry.scheduleWave === wave)
  if (inWave.length === 0) return true
  return inWave.every(
    (entry) =>
      entry.lifecycle === 'COMPLETED' ||
      entry.lifecycle === 'SKIPPED' ||
      entry.lifecycle === 'CANCELLED' ||
      entry.lifecycle === 'MOVED',
  )
}

export function countPassedWavesBefore(
  targetWave: number,
  boutStates: BoutWaveState[],
): number {
  const waves = [...new Set(boutStates.map((entry) => entry.scheduleWave))]
    .filter((wave) => wave < targetWave)
    .sort((a, b) => a - b)

  let passed = 0
  for (const wave of waves) {
    if (isWavePassed(wave, boutStates)) passed += 1
    else break
  }
  return passed
}

export function reassignWavesForPendingBouts(input: {
  pendingBoutIds: string[]
  moves: Array<{ boutId: string; newWave: number }>
  waves: BoutScheduleWaves
}): BoutScheduleWaves {
  const next = { ...input.waves }
  for (const move of input.moves) {
    if (!input.pendingBoutIds.includes(move.boutId)) continue
    next[move.boutId] = move.newWave
  }
  return next
}

export function getCurrentGlobalWave(boutStates: BoutWaveState[]): number {
  const waves = [...new Set(boutStates.map((entry) => entry.scheduleWave))].sort((a, b) => a - b)
  for (const wave of waves) {
    if (!isWavePassed(wave, boutStates)) return wave
  }
  return waves.length > 0 ? waves[waves.length - 1]! : 0
}
