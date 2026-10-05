import { BoutsValidationError } from './errors'
import { buildMatQueue } from './matQueue'
import type { NormalizedBoutsPageSettings } from './normalizeBoutsPageSettings'
import { applyMatQueueAfterOnRuntimeOrder, orderMatBoutsForRuntime } from './matRuntimeOrder'
import { listRunnableMatBoutIds } from './resolvePostponeAnchor'
import type { BoutScheduleOverrides } from './scheduleOverrides'
import {
  buildSportDependencyGraph,
  resolveDownstreamBoutIds,
  sportPredecessors,
} from './sportDependencies'
import type { InternalBout } from './types'

/** Include queue-after chains within a category, plus bouts anchored directly on the root. */
export function shouldIncludeQueueAfterChainedBout(input: {
  boutCategoryKey: string
  queueAfterBoutId: string
  rootBoutId: string
  anchorCategoryKey: string | undefined
}): boolean {
  if (input.queueAfterBoutId === input.rootBoutId) return true
  if (!input.anchorCategoryKey) return false
  return input.boutCategoryKey === input.anchorCategoryKey
}

function sortCascadeBoutIds(
  cascade: Set<string>,
  rootBoutId: string,
  runnableMatBoutIds: readonly string[],
): string[] {
  const ordered = [...cascade].sort(
    (left, right) =>
      runnableMatBoutIds.indexOf(left) - runnableMatBoutIds.indexOf(right),
  )
  const withoutRoot = ordered.filter((boutId) => boutId !== rootBoutId)
  return [rootBoutId, ...withoutRoot]
}

export function collectMatPostponeCascadeBoutIds(input: {
  rootBoutId: string
  matBouts: InternalBout[]
  completedBoutIds: ReadonlySet<string>
  runnableMatBoutIds: readonly string[]
  overrides?: BoutScheduleOverrides
}): string[] {
  const matBoutIds = new Set(input.matBouts.map((bout) => bout.id))
  const runnableSet = new Set(input.runnableMatBoutIds)
  const graph = buildSportDependencyGraph(input.matBouts, matBoutIds)
  const overrides = input.overrides ?? {}
  const categoryKeyByBoutId = new Map(input.matBouts.map((bout) => [bout.id, bout.categoryKey]))

  const cascade = new Set<string>([input.rootBoutId])
  for (const boutId of resolveDownstreamBoutIds(input.rootBoutId, input.matBouts)) {
    if (
      matBoutIds.has(boutId) &&
      !input.completedBoutIds.has(boutId) &&
      runnableSet.has(boutId)
    ) {
      cascade.add(boutId)
    }
  }

  let changed = true
  while (changed) {
    changed = false

    for (const bout of input.matBouts) {
      if (cascade.has(bout.id)) continue
      if (input.completedBoutIds.has(bout.id)) continue
      if (!runnableSet.has(bout.id)) continue

      const incompletePreds = sportPredecessors(graph, bout.id).filter(
        (predId) => !input.completedBoutIds.has(predId),
      )
      if (incompletePreds.some((predId) => cascade.has(predId))) {
        cascade.add(bout.id)
        changed = true
      }
    }

    for (const bout of input.matBouts) {
      if (cascade.has(bout.id)) continue
      if (input.completedBoutIds.has(bout.id)) continue
      if (!runnableSet.has(bout.id)) continue

      const queueAfterBoutId = overrides[bout.id]?.queueAfterBoutId
      if (
        queueAfterBoutId &&
        cascade.has(queueAfterBoutId) &&
        shouldIncludeQueueAfterChainedBout({
          boutCategoryKey: bout.categoryKey,
          queueAfterBoutId,
          rootBoutId: input.rootBoutId,
          anchorCategoryKey: categoryKeyByBoutId.get(queueAfterBoutId),
        })
      ) {
        cascade.add(bout.id)
        changed = true
      }
    }
  }

  return sortCascadeBoutIds(cascade, input.rootBoutId, input.runnableMatBoutIds)
}

function mandatoryPostponeCascadeFloor(input: {
  preliminaryCascadeBoutIds: readonly string[]
  rootBoutId: string
  matBouts: InternalBout[]
  completedBoutIds: ReadonlySet<string>
}): string[] {
  const boutIds = new Set(input.matBouts.map((bout) => bout.id))
  const graph = buildSportDependencyGraph(input.matBouts, boutIds)
  const floor = new Set<string>([input.rootBoutId])

  for (const boutId of input.preliminaryCascadeBoutIds) {
    if (boutId === input.rootBoutId) continue
    const incompletePreds = sportPredecessors(graph, boutId).filter(
      (predId) => !input.completedBoutIds.has(predId),
    )
    if (incompletePreds.length > 0 && incompletePreds.every((predId) => floor.has(predId))) {
      floor.add(boutId)
    }
  }

  return input.preliminaryCascadeBoutIds.filter((boutId) => floor.has(boutId))
}

function isPostponeCascadeRunnable(input: {
  cascadeBoutIds: readonly string[]
  rootBoutId: string
  postponeAfterBoutId: string
  overrides: BoutScheduleOverrides
  groupedMats: Array<{ matIndex: number; bouts: InternalBout[] }>
  matIndex: number
  settings: NormalizedBoutsPageSettings
  matBouts: InternalBout[]
  runnableMatBoutIds: readonly string[]
  completedBoutIds: ReadonlySet<string>
  orderedMatBoutsBefore: InternalBout[]
}): boolean {
  const rootIndex = input.runnableMatBoutIds.indexOf(input.rootBoutId)
  const anchorIndex = input.runnableMatBoutIds.indexOf(input.postponeAfterBoutId)
  if (rootIndex < 0 || anchorIndex < 0 || rootIndex >= anchorIndex) return false

  try {
    const nextOverrides = buildPostponeCascadeOverrides({
      rootBoutId: input.rootBoutId,
      cascadeBoutIds: input.cascadeBoutIds,
      postponeAfterBoutId: input.postponeAfterBoutId,
      overrides: input.overrides,
      matBouts: input.matBouts,
      runnableMatBoutIds: input.runnableMatBoutIds,
      completedBoutIds: input.completedBoutIds,
    })
    const orderedAfter = applyMatQueueAfterOnRuntimeOrder(
      input.orderedMatBoutsBefore,
      nextOverrides,
    )
    const runnableAfter = listRunnableMatBoutIds(
      orderedAfter.map((bout) => bout.id),
      input.completedBoutIds,
    )
    if (runnableAfter.indexOf(input.rootBoutId) <= rootIndex) return false
    assertRunnableOrderRespectsSportDependencies({
      matBouts: input.matBouts,
      runnableBoutIds: runnableAfter,
      completedBoutIds: input.completedBoutIds,
    })
    return true
  } catch {
    return false
  }
}

/** Trim cascade until simulated postpone keeps sport order and moves the root forward. */
export function filterCascadeForPostponeAnchor(input: {
  cascadeBoutIds: readonly string[]
  rootBoutId: string
  postponeAfterBoutId: string
  overrides: BoutScheduleOverrides
  groupedMats: Array<{ matIndex: number; bouts: InternalBout[] }>
  matIndex: number
  settings: NormalizedBoutsPageSettings
  matBouts: InternalBout[]
  runnableMatBoutIds: readonly string[]
  completedBoutIds: ReadonlySet<string>
  orderedMatBoutsBefore: InternalBout[]
}): string[] {
  let sorted = sortCascadeBoutIds(
    new Set(input.cascadeBoutIds),
    input.rootBoutId,
    input.runnableMatBoutIds,
  )
  const floor = mandatoryPostponeCascadeFloor({
    preliminaryCascadeBoutIds: input.cascadeBoutIds,
    rootBoutId: input.rootBoutId,
    matBouts: input.matBouts,
    completedBoutIds: input.completedBoutIds,
  })

  while (sorted.length > floor.length) {
    if (isPostponeCascadeRunnable({ ...input, cascadeBoutIds: sorted })) {
      return sorted
    }
    sorted = sorted.slice(0, -1)
  }

  if (!isPostponeCascadeRunnable({ ...input, cascadeBoutIds: sorted })) {
    throw new BoutsValidationError(
      'Нельзя перенести поединок: зависимые бои категории должны оставаться после него',
    )
  }

  return sorted
}

export function buildPostponeCascadeOverrides(input: {
  rootBoutId: string
  cascadeBoutIds: readonly string[]
  postponeAfterBoutId: string
  overrides: BoutScheduleOverrides
  matBouts: InternalBout[]
  runnableMatBoutIds: readonly string[]
  completedBoutIds: ReadonlySet<string>
}): BoutScheduleOverrides {
  const cascadeSet = new Set(input.cascadeBoutIds)
  const nextOverrides = { ...input.overrides }

  for (const [boutId, entry] of Object.entries(nextOverrides)) {
    const queueAfterBoutId = entry?.queueAfterBoutId
    if (!queueAfterBoutId) continue
    if (cascadeSet.has(boutId)) continue
    if (!cascadeSet.has(queueAfterBoutId)) continue

    const { queueAfterBoutId: _removed, ...rest } = entry
    if (Object.keys(rest).length === 0) delete nextOverrides[boutId]
    else nextOverrides[boutId] = rest
  }

  for (let index = 0; index < input.cascadeBoutIds.length; index += 1) {
    const boutId = input.cascadeBoutIds[index]!
    if (boutId === input.rootBoutId) {
      nextOverrides[boutId] = {
        ...nextOverrides[boutId],
        queueAfterBoutId: input.postponeAfterBoutId,
      }
      continue
    }

    nextOverrides[boutId] = {
      ...nextOverrides[boutId],
      queueAfterBoutId: input.cascadeBoutIds[index - 1]!,
    }
  }

  return nextOverrides
}

export function resolveNextActiveBoutAfterPostpone(input: {
  orderedBouts: InternalBout[]
  cascadeBoutIdSet: ReadonlySet<string>
  completedBoutIds: ReadonlySet<string>
  restUntilByEntryId: Map<string, Date>
  now: Date
  skipRestBlocks?: boolean
}): string | null {
  const queue = buildMatQueue({
    bouts: input.orderedBouts,
    completedBoutIds: new Set(input.completedBoutIds),
    activeBoutId: null,
    restUntilByEntryId: input.restUntilByEntryId,
    now: input.now,
    skipRestBlocks: input.skipRestBlocks,
  })

  for (const entry of queue.upcoming) {
    if (!input.cascadeBoutIdSet.has(entry.bout.id)) {
      return entry.bout.id
    }
  }

  return null
}

export function assertCascadeBeforeAnchor(input: {
  rootBoutId: string
  runnableMatBoutIds: readonly string[]
  anchorIndex: number
}): void {
  const rootIndex = input.runnableMatBoutIds.indexOf(input.rootBoutId)
  if (rootIndex < 0 || rootIndex >= input.anchorIndex) {
    throw new BoutsValidationError('Перенос возможен только вперёд по очереди ковра')
  }
}

export function assertRunnableOrderRespectsSportDependencies(input: {
  matBouts: InternalBout[]
  runnableBoutIds: readonly string[]
  completedBoutIds: ReadonlySet<string>
}): void {
  const boutIds = new Set(input.matBouts.map((bout) => bout.id))
  const graph = buildSportDependencyGraph(input.matBouts, boutIds)
  const indexByBoutId = new Map(input.runnableBoutIds.map((boutId, index) => [boutId, index]))

  for (const boutId of input.runnableBoutIds) {
    const boutIndex = indexByBoutId.get(boutId)
    if (boutIndex == null) continue

    for (const predId of sportPredecessors(graph, boutId)) {
      if (input.completedBoutIds.has(predId)) continue
      const predIndex = indexByBoutId.get(predId)
      if (predIndex == null) continue
      if (predIndex >= boutIndex) {
        throw new BoutsValidationError(
          'Перенос нарушил спортивные зависимости между поединками',
        )
      }
    }
  }
}
