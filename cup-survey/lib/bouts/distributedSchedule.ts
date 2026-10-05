import { collectKnownAthleteIds, type EntryToAthleteMap } from './athleteIdentity'
import {
  isAthleteParticipationSpacingEnabled,
  requiredSpacingBetween,
} from './athleteParticipationSpacing'
import { compareBoutsForScheduleTieBreak } from './boutScheduleOrder'
import { resolveBoutDurationMinutes } from './boutDuration'
import {
  collectScheduledUsedStages,
  previousUsedStage,
} from './competitionStages'
import { applyMatQueueAfterOverrides } from './applyMatQueueAfterOverrides'
import { sortBoutsForSchedule } from './boutScheduleOrder'
import { UnsatisfiableScheduleError } from './errors'
import type { NormalizedBoutsPageSettings } from './normalizeBoutsPageSettings'
import {
  activePolicyPredecessors,
  activePolicyPredecessorsScheduled,
} from './schedulePolicy'
import type { BoutScheduleOverrides } from './scheduleOverrides'
import {
  assertScheduleConstraintGraphAcyclic,
  buildScheduleConstraintGraph,
  effectivePinnedPartition,
  type Partition,
} from './scheduleConstraintGraph'
import type { ScheduledBoutPlan } from './scheduleTypes'
import { buildPlannedStageContext, resolveStagePlannedStart } from './stageTiming'
import {
  buildSportDependencyGraph,
  sportDescendantClosure,
  sportPredecessors,
  sportPredecessorsScheduled,
} from './sportDependencies'
import { resolveWaveForPlannedStart } from './scheduleWaves'
import { tournamentInfo } from '../config/tournament'
import type { InternalBout } from './types'

const EPOCH = new Date(0)

function maxDate(dates: Date[]): Date {
  if (dates.length === 0) return EPOCH
  return new Date(Math.max(...dates.map((d) => d.getTime())))
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

function stageMatKey(stage: number, matIndex: number): string {
  return `${stage}:${matIndex}`
}

function buildPartitions(input: {
  bouts: InternalBout[]
  overrides: BoutScheduleOverrides
  pinAllFinalsToEnd: boolean
  sportGraph: ReturnType<typeof buildSportDependencyGraph>
}): Map<string, Partition> {
  const explicitPins = new Set(
    Object.entries(input.overrides)
      .filter(([, o]) => o.pinnedToEnd === true)
      .map(([id]) => id),
  )
  if (input.pinAllFinalsToEnd) {
    for (const bout of input.bouts) {
      if (bout.schedulePhase === 'final') explicitPins.add(bout.id)
    }
  }
  const pinnedClosure = sportDescendantClosure(explicitPins, input.sportGraph)
  const partitions = new Map<string, Partition>()
  for (const bout of input.bouts) {
    partitions.set(
      bout.id,
      effectivePinnedPartition(bout, input.overrides, input.pinAllFinalsToEnd, pinnedClosure),
    )
  }
  return partitions
}

type ManualQueuesByStageMat = Map<
  string,
  { automatic: InternalBout[]; pinned: InternalBout[] }
>

function buildManualQueuesByStageMat(
  boutsByMat: Map<number, InternalBout[]>,
  overrides: BoutScheduleOverrides,
  partitions: Map<string, Partition>,
): ManualQueuesByStageMat {
  const result: ManualQueuesByStageMat = new Map()
  for (const [matIndex, bouts] of boutsByMat) {
    const stages = [...new Set(bouts.map((b) => b.competitionStage))]
    for (const stage of stages) {
      const stageBouts = bouts.filter((b) => b.competitionStage === stage)
      const automatic = stageBouts
        .filter((b) => partitions.get(b.id) === 'automatic')
        .filter((b) => typeof overrides[b.id]?.manualOrder === 'number')
        .sort(
          (a, b) =>
            (overrides[a.id]!.manualOrder! - overrides[b.id]!.manualOrder!) ||
            a.id.localeCompare(b.id),
        )
      const pinned = stageBouts
        .filter((b) => partitions.get(b.id) === 'pinned')
        .filter((b) => typeof overrides[b.id]?.manualOrder === 'number')
        .sort(
          (a, b) =>
            (overrides[a.id]!.manualOrder! - overrides[b.id]!.manualOrder!) ||
            a.id.localeCompare(b.id),
        )
      if (automatic.length > 0 || pinned.length > 0) {
        result.set(stageMatKey(stage, matIndex), { automatic, pinned })
      }
    }
  }
  return result
}

function stageMatManualHeadAllowed(
  bout: InternalBout,
  matIndex: number,
  partitions: Map<string, Partition>,
  queuesByStageMat: ManualQueuesByStageMat,
  remaining: Set<InternalBout>,
): boolean {
  const partition = partitions.get(bout.id) ?? 'automatic'
  const queues = queuesByStageMat.get(stageMatKey(bout.competitionStage, matIndex))
  if (!queues) return true
  const queue = partition === 'pinned' ? queues.pinned : queues.automatic
  if (queue.length === 0) return true
  const head = queue.find((queued) => remaining.has(queued))
  if (!head) return true
  return head.id === bout.id
}

function pickMaxRestGapMinutes(
  candidates: InternalBout[],
  plannedEndAtByBout: Map<string, Date>,
  plannedStartAtFor: (bout: InternalBout) => Date,
): InternalBout {
  return [...candidates].sort((a, b) => {
    const gapA = restGapMinutes(a, plannedEndAtByBout, plannedStartAtFor(a))
    const gapB = restGapMinutes(b, plannedEndAtByBout, plannedStartAtFor(b))
    if (gapB !== gapA) return gapB - gapA
    return compareBoutsForScheduleTieBreak(a, b)
  })[0]!
}

function restGapMinutes(
  bout: InternalBout,
  plannedEndAtByBout: Map<string, Date>,
  plannedStartAt: Date,
): number {
  let lastEnd = EPOCH
  for (const [id, endAt] of plannedEndAtByBout) {
    if (!id.startsWith(`${bout.categoryKey}::`)) continue
    if (endAt > lastEnd) lastEnd = endAt
  }
  if (lastEnd.getTime() === EPOCH.getTime()) return 0
  return Math.max(0, Math.round((plannedStartAt.getTime() - lastEnd.getTime()) / 60_000))
}

function isPreviousUsedStagePlanned(
  bout: InternalBout,
  usedStages: number[],
  plannedEndAtByBout: Map<string, Date>,
  allBouts: InternalBout[],
): boolean {
  const prevStage = previousUsedStage(bout.competitionStage, usedStages)
  if (prevStage === null) return true
  const prevBouts = allBouts.filter((b) => b.competitionStage === prevStage)
  return prevBouts.every((b) => plannedEndAtByBout.has(b.id))
}

function athleteSpacingSatisfied(input: {
  bout: InternalBout
  candidateWave: number
  lastBoutByAthleteId: Map<string, InternalBout>
  lastWaveByAthleteId: Map<string, number>
  entryToAthlete: EntryToAthleteMap
  settings: NormalizedBoutsPageSettings
}): boolean {
  const spacing = input.settings.athleteParticipationSpacing
  if (!isAthleteParticipationSpacingEnabled(spacing)) return true

  for (const athleteId of collectKnownAthleteIds(input.bout, input.entryToAthlete)) {
    const previousBout = input.lastBoutByAthleteId.get(athleteId)
    const previousWave = input.lastWaveByAthleteId.get(athleteId)
    if (!previousBout || previousWave == null) continue

    const required = requiredSpacingBetween(previousBout, input.bout, spacing)
    if (spacing.mode === 'BOUT_COUNT') {
      const gap = input.candidateWave - previousWave - 1
      if (gap < required) return false
    }
  }
  return true
}

export function buildDistributedSchedules(input: {
  boutsByMat: Map<number, InternalBout[]>
  overrides: BoutScheduleOverrides
  settings: NormalizedBoutsPageSettings
  matStartTimes: Map<number, Date>
  eventDate?: string
  entryToAthlete?: EntryToAthleteMap
}): Map<number, ScheduledBoutPlan[]> {
  const eventDate = input.eventDate ?? tournamentInfo.eventDate
  const allBouts = [...input.boutsByMat.values()].flat()
  const boutIds = new Set(allBouts.map((b) => b.id))
  const boutMatIndex = new Map<string, number>()
  for (const [matIndex, bouts] of input.boutsByMat) {
    for (const bout of bouts) boutMatIndex.set(bout.id, matIndex)
  }

  const usedStages = collectScheduledUsedStages(allBouts)

  const sportGraph = buildSportDependencyGraph(allBouts, boutIds)
  const partitions = buildPartitions({
    bouts: allBouts,
    overrides: input.overrides,
    pinAllFinalsToEnd: input.settings.pinAllFinalsToEnd,
    sportGraph,
  })

  const explicitPins = new Set(
    Object.entries(input.overrides)
      .filter(([, o]) => o.pinnedToEnd === true)
      .map(([id]) => id),
  )
  if (input.settings.pinAllFinalsToEnd) {
    for (const bout of allBouts) {
      if (bout.schedulePhase === 'final') explicitPins.add(bout.id)
    }
  }
  const pinnedClosure = sportDescendantClosure(explicitPins, sportGraph)

  const constraintGraph = buildScheduleConstraintGraph({
    bouts: allBouts,
    boutsByMat: input.boutsByMat,
    sportGraph,
    overrides: input.overrides,
    pinAllFinalsToEnd: input.settings.pinAllFinalsToEnd,
    pinnedClosure,
    partitions,
  })
  assertScheduleConstraintGraphAcyclic(constraintGraph)

  const matAvailableAt = new Map<number, Date>(input.matStartTimes)
  const plannedEndAtByBout = new Map<string, Date>()
  const remainingAutomaticByStageMat = new Map<string, number>()
  const lastAutomaticEndByStageMat = new Map<string, Date | null>()

  for (const [matIndex, bouts] of input.boutsByMat) {
    const stages = [...new Set(bouts.map((b) => b.competitionStage))]
    for (const stage of stages) {
      const key = stageMatKey(stage, matIndex)
      remainingAutomaticByStageMat.set(
        key,
        bouts.filter(
          (b) => b.competitionStage === stage && partitions.get(b.id) === 'automatic',
        ).length,
      )
      lastAutomaticEndByStageMat.set(key, null)
    }
  }

  const remaining = new Set(allBouts)
  const scheduled: ScheduledBoutPlan[] = []
  const spacingEnabled = isAthleteParticipationSpacingEnabled(
    input.settings.athleteParticipationSpacing,
  )
  const entryToAthlete = input.entryToAthlete ?? new Map<string, string>()
  const lastBoutByAthleteId = new Map<string, InternalBout>()
  const lastWaveByAthleteId = new Map<string, number>()
  const lastEndAtByAthleteId = new Map<string, Date>()
  let waveState = { currentWave: 0, waveAnchorTimeMs: null as number | null }

  const durationFor = (bout: InternalBout) =>
    resolveBoutDurationMinutes({
      categoryKey: bout.categoryKey,
      overrides: input.settings.ageDivisionDurationOverrides,
    })

  const plannedCtx = (): ReturnType<typeof buildPlannedStageContext> =>
    buildPlannedStageContext({
      allBouts,
      plannedEndAtByBout,
      pageSettings: input.settings,
      eventDate,
    })

  const earliestStart = (bout: InternalBout): Date => {
    const matIndex = boutMatIndex.get(bout.id)!
    const partition = partitions.get(bout.id) ?? 'automatic'
    const matReady = matAvailableAt.get(matIndex) ?? EPOCH
    const sportReady = maxDate(
      sportPredecessors(sportGraph, bout.id).map((p) => plannedEndAtByBout.get(p) ?? EPOCH),
    )
    const policyReady = maxDate(
      activePolicyPredecessors(bout.id, constraintGraph).map(
        (p) => plannedEndAtByBout.get(p) ?? EPOCH,
      ),
    )
    const pinnedBarrier =
      partition === 'pinned'
        ? (lastAutomaticEndByStageMat.get(stageMatKey(bout.competitionStage, matIndex)) ?? EPOCH)
        : EPOCH
    const stageFloor = resolveStagePlannedStart(bout.competitionStage, plannedCtx())
    const bounds = [matReady, sportReady, policyReady, pinnedBarrier, stageFloor]

    if (spacingEnabled && input.settings.athleteParticipationSpacing.mode === 'TIME') {
      for (const athleteId of collectKnownAthleteIds(bout, entryToAthlete)) {
        const previousBout = lastBoutByAthleteId.get(athleteId)
        const lastEndAt = lastEndAtByAthleteId.get(athleteId)
        if (!previousBout || !lastEndAt) continue
        const requiredMinutes = requiredSpacingBetween(
          previousBout,
          bout,
          input.settings.athleteParticipationSpacing,
        )
        bounds.push(addMinutes(lastEndAt, requiredMinutes))
      }
    }

    return maxDate(bounds)
  }

  const pickNextBout = (eligible: InternalBout[]): InternalBout => {
    const withStart = eligible.map((bout) => ({ bout, start: earliestStart(bout) }))
    const minStart = Math.min(...withStart.map((x) => x.start.getTime()))
    const candidates = withStart.filter((x) => x.start.getTime() === minStart).map((x) => x.bout)
    return pickMaxRestGapMinutes(candidates, plannedEndAtByBout, earliestStart)
  }

  while (remaining.size > 0) {
    const queuesByStageMat = buildManualQueuesByStageMat(
      input.boutsByMat,
      input.overrides,
      partitions,
    )

    const eligible = [...remaining].filter((bout) => {
      const matIndex = boutMatIndex.get(bout.id)!
      if (!sportPredecessorsScheduled(bout.id, sportGraph, plannedEndAtByBout)) return false
      if (!activePolicyPredecessorsScheduled(bout.id, constraintGraph, plannedEndAtByBout)) {
        return false
      }
      if (
        !isPreviousUsedStagePlanned(bout, usedStages, plannedEndAtByBout, allBouts)
      ) {
        return false
      }
      const partition = partitions.get(bout.id) ?? 'automatic'
      const stageMat = stageMatKey(bout.competitionStage, matIndex)
      if (
        partition === 'pinned' &&
        (remainingAutomaticByStageMat.get(stageMat) ?? 0) > 0
      ) {
        return false
      }
      if (
        !stageMatManualHeadAllowed(bout, matIndex, partitions, queuesByStageMat, remaining)
      ) {
        return false
      }
      if (spacingEnabled) {
        const plannedStartAt = earliestStart(bout)
        const { wave: candidateWave } = resolveWaveForPlannedStart(plannedStartAt, waveState)
        if (
          !athleteSpacingSatisfied({
            bout,
            candidateWave,
            lastBoutByAthleteId,
            lastWaveByAthleteId,
            entryToAthlete,
            settings: input.settings,
          })
        ) {
          return false
        }
      }
      return true
    })

    if (eligible.length === 0) {
      throw new UnsatisfiableScheduleError()
    }

    const bout = pickNextBout(eligible)
    const matIndex = boutMatIndex.get(bout.id)!
    const plannedStartAt = earliestStart(bout)
    const plannedEndAt = addMinutes(plannedStartAt, durationFor(bout))
    const waveResolved = resolveWaveForPlannedStart(plannedStartAt, waveState)
    const scheduleWave = waveResolved.wave
    waveState = waveResolved.nextState

    plannedEndAtByBout.set(bout.id, plannedEndAt)
    matAvailableAt.set(
      matIndex,
      addMinutes(plannedEndAt, input.settings.boutBreakMinutes),
    )

    const stageMat = stageMatKey(bout.competitionStage, matIndex)
    if ((partitions.get(bout.id) ?? 'automatic') === 'automatic') {
      remainingAutomaticByStageMat.set(
        stageMat,
        (remainingAutomaticByStageMat.get(stageMat) ?? 0) - 1,
      )
      lastAutomaticEndByStageMat.set(stageMat, plannedEndAt)
    }

    scheduled.push({ bout, matIndex, plannedStartAt, plannedEndAt, scheduleWave })

    if (spacingEnabled) {
      for (const athleteId of collectKnownAthleteIds(bout, entryToAthlete)) {
        lastBoutByAthleteId.set(athleteId, bout)
        lastWaveByAthleteId.set(athleteId, scheduleWave)
        lastEndAtByAthleteId.set(athleteId, plannedEndAt)
      }
    }

    remaining.delete(bout)
  }

  const byMat = new Map<number, ScheduledBoutPlan[]>()
  for (const plan of scheduled) {
    const list = byMat.get(plan.matIndex) ?? []
    list.push(plan)
    byMat.set(plan.matIndex, list)
  }
  for (const [matIndex, plans] of byMat) {
    plans.sort((a, b) => a.plannedStartAt.getTime() - b.plannedStartAt.getTime())
    byMat.set(matIndex, plans)
  }
  return byMat
}

export function buildDistributedSchedulesWithFallback(
  input: Parameters<typeof buildDistributedSchedules>[0],
): Map<number, ScheduledBoutPlan[]> {
  try {
    return buildDistributedSchedules(input)
  } catch (error) {
    if (!(error instanceof UnsatisfiableScheduleError)) {
      throw error
    }

    const plans = new Map<number, ScheduledBoutPlan[]>()
    for (const [matIndex, bouts] of input.boutsByMat) {
      const matStart = input.matStartTimes.get(matIndex) ?? new Date(0)
      const fallbackOrder = applyMatQueueAfterOverrides(
        sortBoutsForSchedule(bouts),
        input.overrides ?? {},
      )
      plans.set(
        matIndex,
        fallbackOrder.map((bout) => ({
          bout,
          matIndex,
          plannedStartAt: matStart,
          plannedEndAt: matStart,
        })),
      )
    }
    return plans
  }
}

export function collectPlannedEndAtByBout(
  plansByMat: Map<number, ScheduledBoutPlan[]>,
): Map<string, Date> {
  const result = new Map<string, Date>()
  for (const plans of plansByMat.values()) {
    for (const plan of plans) {
      result.set(plan.bout.id, plan.plannedEndAt)
    }
  }
  return result
}
