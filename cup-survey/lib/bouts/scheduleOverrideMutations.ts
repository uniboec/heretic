import type { Prisma } from '@prisma/client'
import { buildGroupedBoutsFromPairs } from './schedulePipeline'
import {
  buildScheduleConstraintGraph,
  effectivePinnedPartition,
  type Partition,
} from './scheduleConstraintGraph'
import { PinCascadeConfirmationRequiredError } from './errors'
import { buildSportDependencyGraph, sportDescendantClosure } from './sportDependencies'
import { ScheduleConstraintCycleError } from './errors'
import type { BoutScheduleOverrides } from './scheduleOverrides'
import {
  clearManualOrderForMat,
  parseBoutScheduleOverrides,
  type ProposedScheduleState,
} from './scheduleOverrides'
import type { InternalBout } from './types'
import type { NormalizedBoutsPageSettings } from './normalizeBoutsPageSettings'

export function getPinCascadeDescendantIds(
  boutId: string,
  allBouts: InternalBout[],
  overrides: BoutScheduleOverrides,
): string[] {
  const boutIds = new Set(allBouts.map((b) => b.id))
  const sportGraph = buildSportDependencyGraph(allBouts, boutIds)
  const closure = sportDescendantClosure(new Set([boutId]), sportGraph)
  closure.delete(boutId)
  return [...closure].filter((id) => overrides[id]?.pinnedToEnd !== true)
}

export function buildProposedScheduleState(input: {
  groupedMats: Array<{ matIndex: number; bouts: InternalBout[] }>
  overrides: BoutScheduleOverrides
  settings: Pick<NormalizedBoutsPageSettings, 'pinAllFinalsToEnd'>
}): ProposedScheduleState {
  const boutsByMat = new Map(input.groupedMats.map((mat) => [mat.matIndex, mat.bouts]))
  return {
    overrides: input.overrides,
    pinAllFinalsToEnd: input.settings.pinAllFinalsToEnd,
    boutsByMat,
  }
}

export function assertProposedScheduleStateAcyclic(state: ProposedScheduleState): void {
  const allBouts = [...state.boutsByMat.values()].flat()
  const boutIds = new Set(allBouts.map((b) => b.id))
  const sportGraph = buildSportDependencyGraph(allBouts, boutIds)

  const explicitPins = new Set(
    Object.entries(state.overrides)
      .filter(([, o]) => o.pinnedToEnd === true)
      .map(([id]) => id),
  )
  if (state.pinAllFinalsToEnd) {
    for (const bout of allBouts) {
      if (bout.schedulePhase === 'final') explicitPins.add(bout.id)
    }
  }
  const pinnedClosure = sportDescendantClosure(explicitPins, sportGraph)
  const partitions = new Map<string, Partition>()
  for (const bout of allBouts) {
    partitions.set(
      bout.id,
      effectivePinnedPartition(bout, state.overrides, state.pinAllFinalsToEnd, pinnedClosure),
    )
  }

  try {
    buildScheduleConstraintGraph({
      bouts: allBouts,
      boutsByMat: state.boutsByMat,
      sportGraph,
      overrides: state.overrides,
      pinAllFinalsToEnd: state.pinAllFinalsToEnd,
      pinnedClosure,
      partitions,
    })
  } catch (error) {
    if (error instanceof ScheduleConstraintCycleError) throw error
    throw error
  }
}

export function renumberManualOrderForMat(
  matBouts: InternalBout[],
  orderedBoutIds: string[],
  overrides: BoutScheduleOverrides,
): BoutScheduleOverrides {
  const next = clearManualOrderForMat(matBouts, overrides)
  for (let index = 0; index < orderedBoutIds.length; index++) {
    const boutId = orderedBoutIds[index]!
    next[boutId] = { ...next[boutId], manualOrder: index }
  }
  return next
}

export function splitOverridesByCategory(
  matBouts: InternalBout[],
  overrides: BoutScheduleOverrides,
): Map<string, BoutScheduleOverrides> {
  const byCategory = new Map<string, BoutScheduleOverrides>()
  for (const bout of matBouts) {
    const entry = overrides[bout.id]
    if (!entry) continue
    const categoryOverrides = byCategory.get(bout.categoryKey) ?? {}
    categoryOverrides[bout.id] = entry
    byCategory.set(bout.categoryKey, categoryOverrides)
  }
  return byCategory
}

export function diffOverridesForMat(
  matBouts: InternalBout[],
  before: BoutScheduleOverrides,
  after: BoutScheduleOverrides,
): Map<string, BoutScheduleOverrides> {
  const byCategory = new Map<string, BoutScheduleOverrides>()
  for (const bout of matBouts) {
    const prev = before[bout.id]
    const next = after[bout.id]
    const prevJson = JSON.stringify(prev ?? null)
    const nextJson = JSON.stringify(next ?? null)
    if (prevJson === nextJson) continue
    const categoryOverrides = byCategory.get(bout.categoryKey) ?? {}
    categoryOverrides[bout.id] = next ?? {}
    byCategory.set(bout.categoryKey, categoryOverrides)
  }
  return byCategory
}

export async function loadPairsForScheduleValidation(
  tx: Prisma.TransactionClient,
  matCount: number,
) {
  const { getActivePublishedGeneration, getCurrentPublishedDraws } = await import(
    '../brackets/generation/publishedDraws'
  )
  const published = await getActivePublishedGeneration(tx)
  if (!published) return null
  const pairs = await getCurrentPublishedDraws({ db: tx, activeGeneration: published })
  const grouped = buildGroupedBoutsFromPairs(pairs, matCount)
  return { pairs, grouped }
}

export function collectPinCascadeConfirmationIds(
  boutIds: readonly string[],
  allBouts: InternalBout[],
  overrides: BoutScheduleOverrides,
): string[] {
  const pinning = new Set(boutIds)
  const cascade = new Set<string>()
  for (const boutId of boutIds) {
    for (const descendantId of getPinCascadeDescendantIds(boutId, allBouts, overrides)) {
      if (!pinning.has(descendantId)) cascade.add(descendantId)
    }
  }
  return [...cascade]
}

export function assertPinCascadeConfirmed(input: {
  boutId: string
  pinnedToEnd: boolean
  confirmCascade?: boolean
  allBouts: InternalBout[]
  overrides: BoutScheduleOverrides
}): void {
  if (!input.pinnedToEnd || input.confirmCascade === true) return
  const cascadeIds = collectPinCascadeConfirmationIds(
    [input.boutId],
    input.allBouts,
    input.overrides,
  )
  if (cascadeIds.length > 0) {
    throw new PinCascadeConfirmationRequiredError(cascadeIds)
  }
}

export function assertBulkPinCascadeConfirmed(input: {
  boutIds: readonly string[]
  pinnedToEnd: boolean
  confirmCascade?: boolean
  allBouts: InternalBout[]
  overrides: BoutScheduleOverrides
}): void {
  if (!input.pinnedToEnd || input.confirmCascade === true) return
  const cascadeIds = collectPinCascadeConfirmationIds(
    input.boutIds,
    input.allBouts,
    input.overrides,
  )
  if (cascadeIds.length > 0) {
    throw new PinCascadeConfirmationRequiredError(cascadeIds)
  }
}

export function mergeCategoryScheduleOverrides(
  existing: unknown,
  patch: BoutScheduleOverrides,
): BoutScheduleOverrides {
  const current = parseBoutScheduleOverrides(existing)
  const result = { ...current }
  for (const [boutId, value] of Object.entries(patch)) {
    if (!value || Object.keys(value).length === 0) delete result[boutId]
    else result[boutId] = value
  }
  return result
}
