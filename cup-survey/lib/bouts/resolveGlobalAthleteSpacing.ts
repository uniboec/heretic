import { collectKnownAthleteIds, type EntryToAthleteMap } from './athleteIdentity'
import {
  computeAthleteParticipationSpacingRestUntil,
  computeEffectiveRestUntil,
  isBeforeEffectiveRest,
} from './effectiveAthleteRest'
import {
  isAthleteParticipationSpacingEnabled,
  requiredSpacingBetween,
  type AthleteParticipationSpacing,
} from './athleteParticipationSpacing'
import type { BoutScheduleWaves } from './boutScheduleWaves'
import { getScheduleWave } from './boutScheduleWaves'
import {
  buildGlobalAthleteSpacingContext,
  isAthleteSpacingWaveGapSatisfied,
  type AthleteSpacingExecution,
  type GlobalAthleteSpacingContext,
} from './globalAthleteSpacingContext'
import type { DeferredBout, GlobalAthleteSpacingResult } from './globalAthleteSpacingTypes'
import {
  getCurrentGlobalWave,
  reassignWavesForPendingBouts,
  type BoutWaveState,
} from './scheduleWaves'
import type { ScheduledBoutPlan } from './scheduleTypes'
import type { InternalBout } from './types'

export type BoutSortMeta = {
  bout: InternalBout
  matIndex: number
  baseIndex: number
  plannedStartAtMs: number
}

export function compareBoutSortMeta(a: BoutSortMeta, b: BoutSortMeta): number {
  if (a.plannedStartAtMs !== b.plannedStartAtMs) return a.plannedStartAtMs - b.plannedStartAtMs
  if (a.baseIndex !== b.baseIndex) return a.baseIndex - b.baseIndex
  if (a.matIndex !== b.matIndex) return a.matIndex - b.matIndex
  if (a.bout.matchNumber !== b.bout.matchNumber) return a.bout.matchNumber - b.bout.matchNumber
  return a.bout.id.localeCompare(b.bout.id)
}

function buildSortMeta(
  perMatOrder: Map<number, InternalBout[]>,
  plannedStartAtByBoutId: Map<string, number>,
): BoutSortMeta[] {
  const result: BoutSortMeta[] = []
  for (const [matIndex, bouts] of perMatOrder) {
    bouts.forEach((bout, baseIndex) => {
      result.push({
        bout,
        matIndex,
        baseIndex,
        plannedStartAtMs: plannedStartAtByBoutId.get(bout.id) ?? Number.MAX_SAFE_INTEGER,
      })
    })
  }
  return result
}

function buildPlannedStartAtByBoutId(
  plansByMat?: Map<number, ScheduledBoutPlan[]>,
): Map<string, number> {
  const plannedStartAtByBoutId = new Map<string, number>()
  if (!plansByMat) return plannedStartAtByBoutId
  for (const plans of plansByMat.values()) {
    for (const plan of plans) {
      plannedStartAtByBoutId.set(plan.bout.id, plan.plannedStartAt.getTime())
    }
  }
  return plannedStartAtByBoutId
}

type AthleteSpacingCheck = {
  runnable: boolean
  reason?: DeferredBout['reason']
  athleteId?: string
  meta?: Partial<DeferredBout>
}

function checkBoutSpacingForAthlete(input: {
  bout: InternalBout
  athleteId: string
  context: GlobalAthleteSpacingContext
  spacing: AthleteParticipationSpacing
  candidateWave: number
  now: Date
  restUntilByEntryId: Map<string, Date>
  entryToAthlete: EntryToAthleteMap
}): AthleteSpacingCheck {
  if (input.context.busyAthleteIds.has(input.athleteId)) {
    return { runnable: false, reason: 'ATHLETE_BUSY', athleteId: input.athleteId }
  }

  const previousBout = input.context.lastBoutByAthleteId.get(input.athleteId) ?? null
  const previousEndedAt = input.context.lastEndAtByAthleteId.get(input.athleteId) ?? null

  const entryRestUntil = [...input.restUntilByEntryId.entries()]
    .filter(([entryId]) => input.entryToAthlete.get(entryId) === input.athleteId)
    .map(([, until]) => until)
    .reduce<Date | null>((max, until) => {
      if (!max || until.getTime() > max.getTime()) return until
      return max
    }, null)

  const spacingRestUntil = computeAthleteParticipationSpacingRestUntil({
    previousBout,
    nextBout: input.bout,
    previousEndedAt,
    settings: input.spacing,
  })

  const effectiveRestUntil = computeEffectiveRestUntil({
    existingRestUntil: entryRestUntil,
    spacingRestUntil,
  })

  if (isBeforeEffectiveRest(input.now, effectiveRestUntil)) {
    return {
      runnable: false,
      reason: 'EFFECTIVE_REST',
      athleteId: input.athleteId,
      meta: { effectiveRestUntil: effectiveRestUntil?.toISOString() },
    }
  }

  if (
    input.spacing.mode === 'BOUT_COUNT' &&
    !isAthleteSpacingWaveGapSatisfied({
      athleteId: input.athleteId,
      candidateBout: input.bout,
      context: input.context,
      spacing: input.spacing,
      candidateWave: input.candidateWave,
    })
  ) {
    const previousWave = input.context.lastWaveByAthleteId.get(input.athleteId)
    const required =
      previousBout != null
        ? requiredSpacingBetween(previousBout, input.bout, input.spacing)
        : 0
    return {
      runnable: false,
      reason: 'ATHLETE_SPACING',
      athleteId: input.athleteId,
      meta: {
        requiredWave: previousWave != null ? previousWave + required + 1 : undefined,
        currentWave: input.candidateWave,
      },
    }
  }

  return { runnable: true, athleteId: input.athleteId }
}

function checkBoutSpacingEligibility(input: {
  bout: InternalBout
  context: GlobalAthleteSpacingContext
  spacing: AthleteParticipationSpacing
  candidateWave: number
  now: Date
  restUntilByEntryId: Map<string, Date>
  entryToAthlete: EntryToAthleteMap
}): AthleteSpacingCheck {
  const athleteIds = collectKnownAthleteIds(input.bout, input.entryToAthlete)
  if (athleteIds.length === 0) return { runnable: true }

  for (const athleteId of athleteIds) {
    const check = checkBoutSpacingForAthlete({
      bout: input.bout,
      athleteId,
      context: input.context,
      spacing: input.spacing,
      candidateWave: input.candidateWave,
      now: input.now,
      restUntilByEntryId: input.restUntilByEntryId,
      entryToAthlete: input.entryToAthlete,
    })
    if (!check.runnable) return check
  }

  return { runnable: true }
}

function computeMinDeferredWave(input: {
  bout: InternalBout
  context: GlobalAthleteSpacingContext
  spacing: AthleteParticipationSpacing
  entryToAthlete: EntryToAthleteMap
  boutWaveStates: BoutWaveState[]
  currentWave: number
}): number {
  let minWave = input.currentWave
  for (const athleteId of collectKnownAthleteIds(input.bout, input.entryToAthlete)) {
    const previousBout = input.context.lastBoutByAthleteId.get(athleteId)
    const previousWave = input.context.lastWaveByAthleteId.get(athleteId)
    if (!previousBout || previousWave == null) continue
    const required = requiredSpacingBetween(previousBout, input.bout, input.spacing)
    minWave = Math.max(minWave, previousWave + required + 1)
  }

  const globalWave = getCurrentGlobalWave(input.boutWaveStates)
  return Math.max(minWave, globalWave)
}

function buildWavePatchForDeferred(input: {
  deferredMetas: BoutSortMeta[]
  waves: BoutScheduleWaves
  context: GlobalAthleteSpacingContext
  spacing: AthleteParticipationSpacing
  entryToAthlete: EntryToAthleteMap
  boutWaveStates: BoutWaveState[]
}): Record<string, number> {
  if (input.spacing.mode !== 'BOUT_COUNT' || input.deferredMetas.length === 0) {
    return {}
  }

  const moves: Array<{ boutId: string; newWave: number }> = []
  const pendingIds = input.deferredMetas.map((meta) => meta.bout.id)

  for (const meta of input.deferredMetas) {
    const currentWave = getScheduleWave(meta.bout.id, input.waves) ?? 0
    const minWave = computeMinDeferredWave({
      bout: meta.bout,
      context: input.context,
      spacing: input.spacing,
      entryToAthlete: input.entryToAthlete,
      boutWaveStates: input.boutWaveStates,
      currentWave,
    })
    if (minWave > currentWave) {
      moves.push({ boutId: meta.bout.id, newWave: minWave })
    }
  }

  if (moves.length === 0) return {}

  const nextWaves = reassignWavesForPendingBouts({
    pendingBoutIds: pendingIds,
    moves,
    waves: input.waves,
  })

  const patch: Record<string, number> = {}
  for (const move of moves) {
    patch[move.boutId] = nextWaves[move.boutId]!
  }
  return patch
}

function isLockedBout(
  boutId: string,
  completedBoutIds: Set<string>,
  activeBoutIds: Set<string>,
): boolean {
  return completedBoutIds.has(boutId) || activeBoutIds.has(boutId)
}

export function resolveGlobalAthleteSpacing(input: {
  perMatBaseOrder: Map<number, InternalBout[]>
  completedBoutIds: Set<string>
  activeBoutIds: Set<string>
  boutScheduleWaves: BoutScheduleWaves
  plansByMat?: Map<number, ScheduledBoutPlan[]>
  entryToAthlete: EntryToAthleteMap
  spacing: AthleteParticipationSpacing
  executions: AthleteSpacingExecution[]
  restUntilByEntryId: Map<string, Date>
  now: Date
}): GlobalAthleteSpacingResult {
  if (!isAthleteParticipationSpacingEnabled(input.spacing)) {
    return {
      perMatOrder: new Map(input.perMatBaseOrder),
      deferredBouts: [],
      wavePatch: {},
    }
  }

  const plannedStartAtByBoutId = buildPlannedStartAtByBoutId(input.plansByMat)
  const context = buildGlobalAthleteSpacingContext({
    allBouts: [...input.perMatBaseOrder.values()].flat(),
    boutScheduleWaves: input.boutScheduleWaves,
    entryToAthlete: input.entryToAthlete,
    executions: input.executions,
    restUntilByEntryId: input.restUntilByEntryId,
    spacing: input.spacing,
    now: input.now,
  })

  const pendingMetas: BoutSortMeta[] = []
  const lockedByMat = new Map<number, InternalBout[]>()

  for (const [matIndex, baseOrder] of input.perMatBaseOrder) {
    const locked: InternalBout[] = []
    for (const bout of baseOrder) {
      if (isLockedBout(bout.id, input.completedBoutIds, input.activeBoutIds)) {
        locked.push(bout)
        continue
      }
      pendingMetas.push({
        bout,
        matIndex,
        baseIndex: baseOrder.indexOf(bout),
        plannedStartAtMs: plannedStartAtByBoutId.get(bout.id) ?? Number.MAX_SAFE_INTEGER,
      })
    }
    lockedByMat.set(matIndex, locked)
  }

  pendingMetas.sort(compareBoutSortMeta)

  const runnableIds = new Set<string>()
  const deferredBouts: DeferredBout[] = []
  const selectedBoutByAthlete = new Map<string, string>()

  for (const meta of pendingMetas) {
    const candidateWave = getScheduleWave(meta.bout.id, input.boutScheduleWaves) ?? 0
    const spacingCheck = checkBoutSpacingEligibility({
      bout: meta.bout,
      context,
      spacing: input.spacing,
      candidateWave,
      now: input.now,
      restUntilByEntryId: input.restUntilByEntryId,
      entryToAthlete: input.entryToAthlete,
    })

    if (!spacingCheck.runnable) {
      deferredBouts.push({
        boutId: meta.bout.id,
        reason: spacingCheck.reason ?? 'ATHLETE_SPACING',
        athleteId: spacingCheck.athleteId ?? '',
        ...spacingCheck.meta,
      })
      continue
    }

    const athleteIds = collectKnownAthleteIds(meta.bout, input.entryToAthlete)
    const conflictingAthlete = athleteIds.find((athleteId) => {
      const selected = selectedBoutByAthlete.get(athleteId)
      return selected != null && selected !== meta.bout.id
    })

    if (conflictingAthlete) {
      deferredBouts.push({
        boutId: meta.bout.id,
        reason: 'ATHLETE_SPACING',
        athleteId: conflictingAthlete,
        currentWave: candidateWave,
      })
      continue
    }

    runnableIds.add(meta.bout.id)
    for (const athleteId of athleteIds) {
      selectedBoutByAthlete.set(athleteId, meta.bout.id)
    }
  }

  let deferredMetas = pendingMetas.filter((meta) => !runnableIds.has(meta.bout.id))
  let wavePatch = buildWavePatchForDeferred({
    deferredMetas,
    waves: input.boutScheduleWaves,
    context,
    spacing: input.spacing,
    entryToAthlete: input.entryToAthlete,
    boutWaveStates: context.boutWaveStates,
  })

  if (Object.keys(wavePatch).length > 0) {
    const refinedContext = buildGlobalAthleteSpacingContext({
      allBouts: [...input.perMatBaseOrder.values()].flat(),
      boutScheduleWaves: input.boutScheduleWaves,
      wavePatch,
      entryToAthlete: input.entryToAthlete,
      executions: input.executions,
      restUntilByEntryId: input.restUntilByEntryId,
      spacing: input.spacing,
      now: input.now,
    })
    const refinedPatch = buildWavePatchForDeferred({
      deferredMetas,
      waves: { ...input.boutScheduleWaves, ...wavePatch },
      context: refinedContext,
      spacing: input.spacing,
      entryToAthlete: input.entryToAthlete,
      boutWaveStates: refinedContext.boutWaveStates,
    })
    wavePatch = { ...wavePatch, ...refinedPatch }
  }

  const resultOrder = new Map<number, InternalBout[]>()

  for (const [matIndex, baseOrder] of input.perMatBaseOrder) {
    const locked = lockedByMat.get(matIndex) ?? []
    const pending = baseOrder.filter(
      (bout) => !isLockedBout(bout.id, input.completedBoutIds, input.activeBoutIds),
    )
    const runnable = pending.filter((bout) => runnableIds.has(bout.id))
    const deferred = pending.filter((bout) => !runnableIds.has(bout.id))
    resultOrder.set(matIndex, [...locked, ...runnable, ...deferred])
  }

  return {
    perMatOrder: resultOrder,
    deferredBouts,
    wavePatch,
  }
}

export function getMatOrderFromSpacingResult(
  result: GlobalAthleteSpacingResult,
  matIndex: number,
  fallback: InternalBout[],
): InternalBout[] {
  return result.perMatOrder.get(matIndex) ?? fallback
}
