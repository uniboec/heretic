import { collectKnownAthleteIds, type EntryToAthleteMap } from './athleteIdentity'
import {
  computeAthleteParticipationSpacingRestUntil,
  computeEffectiveRestUntil,
} from './effectiveAthleteRest'
import {
  isAthleteParticipationSpacingEnabled,
  requiredSpacingBetween,
  type AthleteParticipationSpacing,
} from './athleteParticipationSpacing'
import type { BoutScheduleWaves } from './boutScheduleWaves'
import { getScheduleWave } from './boutScheduleWaves'
import { isWavePassed, type BoutWaveLifecycleState, type BoutWaveState } from './scheduleWaves'
import type { InternalBout } from './types'

export type AthleteSpacingExecution = {
  boutId: string
  boutPhase: string
  actualEndAt: Date | null
}

export type GlobalAthleteSpacingContext = {
  busyAthleteIds: Set<string>
  lastBoutByAthleteId: Map<string, InternalBout>
  lastWaveByAthleteId: Map<string, number>
  lastEndAtByAthleteId: Map<string, Date>
  effectiveRestUntilByAthleteId: Map<string, Date>
  boutWaveStates: BoutWaveState[]
  boutById: Map<string, InternalBout>
}

function isActivePhase(boutPhase: string): boolean {
  return boutPhase !== 'scheduled' && boutPhase !== 'completed'
}

function lifecycleFromExecution(
  execution: AthleteSpacingExecution | undefined,
  movedBoutIds: Set<string>,
): BoutWaveLifecycleState {
  if (movedBoutIds.has(execution?.boutId ?? '')) return 'MOVED'
  if (!execution) return 'PENDING'
  if (execution.boutPhase === 'completed' || execution.actualEndAt) return 'COMPLETED'
  if (isActivePhase(execution.boutPhase)) return 'ACTIVE'
  return 'PENDING'
}

export function buildGlobalAthleteSpacingContext(input: {
  allBouts: InternalBout[]
  boutScheduleWaves: BoutScheduleWaves
  entryToAthlete: EntryToAthleteMap
  executions: AthleteSpacingExecution[]
  restUntilByEntryId: Map<string, Date>
  spacing: AthleteParticipationSpacing
  now: Date
  wavePatch?: Record<string, number>
}): GlobalAthleteSpacingContext {
  const executionByBoutId = new Map(input.executions.map((row) => [row.boutId, row]))
  const boutById = new Map(input.allBouts.map((bout) => [bout.id, bout]))
  const mergedWaves = input.wavePatch
    ? { ...input.boutScheduleWaves, ...input.wavePatch }
    : input.boutScheduleWaves

  const boutWaveStates: BoutWaveState[] = input.allBouts.map((bout) => ({
    boutId: bout.id,
    scheduleWave: getScheduleWave(bout.id, mergedWaves) ?? 0,
    lifecycle: lifecycleFromExecution(executionByBoutId.get(bout.id), new Set()),
  }))

  if (input.wavePatch) {
    for (const [boutId, newWave] of Object.entries(input.wavePatch)) {
      const oldWave = getScheduleWave(boutId, input.boutScheduleWaves) ?? 0
      if (oldWave > 0 && oldWave !== newWave) {
        boutWaveStates.push({ boutId, scheduleWave: oldWave, lifecycle: 'MOVED' })
      }
    }
  }

  const busyAthleteIds = new Set<string>()
  const lastBoutByAthleteId = new Map<string, InternalBout>()
  const lastWaveByAthleteId = new Map<string, number>()
  const lastEndAtByAthleteId = new Map<string, Date>()
  const effectiveRestUntilByAthleteId = new Map<string, Date>()

  const completedOrActive = input.allBouts
    .map((bout) => ({
      bout,
      execution: executionByBoutId.get(bout.id),
      wave: getScheduleWave(bout.id, mergedWaves) ?? 0,
    }))
    .filter((entry) => {
      const phase = entry.execution?.boutPhase ?? 'scheduled'
      return phase === 'completed' || entry.execution?.actualEndAt || isActivePhase(phase)
    })
    .sort((a, b) => {
      const aEnd = a.execution?.actualEndAt?.getTime() ?? 0
      const bEnd = b.execution?.actualEndAt?.getTime() ?? 0
      if (aEnd !== bEnd) return aEnd - bEnd
      return a.wave - b.wave
    })

  for (const entry of completedOrActive) {
    const athleteIds = collectKnownAthleteIds(entry.bout, input.entryToAthlete)
    const phase = entry.execution?.boutPhase ?? 'scheduled'
    if (isActivePhase(phase)) {
      for (const athleteId of athleteIds) busyAthleteIds.add(athleteId)
    }

    const endedAt = entry.execution?.actualEndAt ?? null
    for (const athleteId of athleteIds) {
      lastBoutByAthleteId.set(athleteId, entry.bout)
      lastWaveByAthleteId.set(athleteId, entry.wave)
      if (endedAt) {
        lastEndAtByAthleteId.set(athleteId, endedAt)
      }

      if (!isAthleteParticipationSpacingEnabled(input.spacing)) continue

      const entryRestUntil = [...input.restUntilByEntryId.entries()]
        .filter(([entryId]) => input.entryToAthlete.get(entryId) === athleteId)
        .map(([, until]) => until)
        .reduce<Date | null>((max, until) => {
          if (!max || until.getTime() > max.getTime()) return until
          return max
        }, null)

      const spacingRestUntil = computeAthleteParticipationSpacingRestUntil({
        previousBout: entry.bout,
        nextBout: entry.bout,
        previousEndedAt: endedAt,
        settings: input.spacing,
      })

      const effective = computeEffectiveRestUntil({
        existingRestUntil: entryRestUntil,
        spacingRestUntil,
      })
      if (effective) {
        const prev = effectiveRestUntilByAthleteId.get(athleteId)
        if (!prev || effective.getTime() > prev.getTime()) {
          effectiveRestUntilByAthleteId.set(athleteId, effective)
        }
      }
    }
  }

  for (const [athleteId, restUntil] of effectiveRestUntilByAthleteId) {
    if (restUntil.getTime() > input.now.getTime()) {
      // keep
    }
  }

  return {
    busyAthleteIds,
    lastBoutByAthleteId,
    lastWaveByAthleteId,
    lastEndAtByAthleteId,
    effectiveRestUntilByAthleteId,
    boutWaveStates,
    boutById,
  }
}

export function isAthleteSpacingWaveGapSatisfied(input: {
  athleteId: string
  candidateBout: InternalBout
  context: GlobalAthleteSpacingContext
  spacing: AthleteParticipationSpacing
  candidateWave: number
}): boolean {
  const previousBout = input.context.lastBoutByAthleteId.get(input.athleteId)
  const previousWave = input.context.lastWaveByAthleteId.get(input.athleteId)
  if (!previousBout || previousWave == null) return true

  const required = requiredSpacingBetween(previousBout, input.candidateBout, input.spacing)
  if (required <= 0) return true

  const gap = input.candidateWave - previousWave - 1
  if (gap < required) return false

  for (let wave = previousWave + 1; wave < input.candidateWave; wave += 1) {
    if (!isWavePassed(wave, input.context.boutWaveStates)) return false
  }
  return true
}
