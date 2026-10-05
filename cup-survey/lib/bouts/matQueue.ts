import { isAthleteResting } from './restRules'
import { buildSportDependencyGraph, sportPredecessors } from './sportDependencies'
import type { InternalBout } from './types'

export type MatQueueEntry = {
  bout: InternalBout
  blockedReason?: 'REST' | 'DEPENDENCY' | 'NOT_READY'
  restUntil?: Date
}

export type MatQueueSnapshot = {
  nextAvailable: MatQueueEntry | null
  upcoming: MatQueueEntry[]
  blocked: MatQueueEntry[]
}

export type MatQueueDisplayEntry = MatQueueEntry & {
  isActive: boolean
}

function buildMatQueueEntry(input: {
  bout: InternalBout
  dependencyGraph: ReturnType<typeof buildSportDependencyGraph>
  completedBoutIds: Set<string>
  restUntilByEntryId: Map<string, Date>
  now: Date
  skipRestBlocks?: boolean
}): MatQueueEntry {
  const { bout, dependencyGraph, completedBoutIds, restUntilByEntryId, now, skipRestBlocks } =
    input
  const athleteEntryIds = [
    bout.sideA.kind === 'athlete' ? bout.sideA.entryId : null,
    bout.sideB.kind === 'athlete' ? bout.sideB.entryId : null,
  ].filter((entryId): entryId is string => entryId != null)

  if (!skipRestBlocks) {
    for (const entryId of athleteEntryIds) {
      const restUntil = restUntilByEntryId.get(entryId)
      if (restUntil && isAthleteResting(restUntil, now)) {
        return { bout, blockedReason: 'REST' as const, restUntil }
      }
    }
  }

  if (bout.sideA.kind !== 'athlete' || bout.sideB.kind !== 'athlete') {
    return { bout, blockedReason: 'NOT_READY' as const }
  }

  const unmetPredecessors = sportPredecessors(dependencyGraph, bout.id).filter(
    (predecessorId) => !completedBoutIds.has(predecessorId),
  )
  if (unmetPredecessors.length > 0) {
    return { bout, blockedReason: 'DEPENDENCY' as const }
  }

  return { bout }
}

/** All pending bouts on the mat in runtime order, including the active bout. */
export function buildMatQueueInOrder(input: {
  bouts: InternalBout[]
  completedBoutIds: Set<string>
  activeBoutId: string | null
  restUntilByEntryId: Map<string, Date>
  now: Date
  skipRestBlocks?: boolean
}): MatQueueDisplayEntry[] {
  const { bouts, completedBoutIds, activeBoutId, restUntilByEntryId, now, skipRestBlocks } = input
  const boutIds = new Set(bouts.map((bout) => bout.id))
  const dependencyGraph = buildSportDependencyGraph(bouts, boutIds)

  return bouts
    .filter((bout) => !completedBoutIds.has(bout.id))
    .map((bout) => ({
      ...buildMatQueueEntry({
        bout,
        dependencyGraph,
        completedBoutIds,
        restUntilByEntryId,
        now,
        skipRestBlocks,
      }),
      isActive: bout.id === activeBoutId,
    }))
}

export function shouldAutoAlignMatSessionActiveBout(input: {
  sessionActiveBoutId: string | null
  matBoutIds: Set<string>
  completedBoutIds: Set<string>
  correctionFocusBoutId?: string | null
}): boolean {
  if (input.correctionFocusBoutId) {
    return input.sessionActiveBoutId !== input.correctionFocusBoutId
  }
  if (!input.sessionActiveBoutId) return true
  if (!input.matBoutIds.has(input.sessionActiveBoutId)) return true
  if (input.completedBoutIds.has(input.sessionActiveBoutId)) return true
  return false
}

export function resolveMatControlTargetBoutId(input: {
  sessionActiveBoutId: string | null
  sessionActiveBoutPhase: string | null | undefined
  orderedMatBouts: InternalBout[]
  /** All bout ids assigned to the mat (may be broader than runtime order). */
  matBoutIds?: Set<string>
  completedBoutIds: Set<string>
  restUntilByEntryId: Map<string, Date>
  now: Date
  skipRestBlocks?: boolean
  matInProgressBoutId?: string | null
  correctionFocusBoutId?: string | null
}): string | null {
  const boutIdsOnMat =
    input.matBoutIds ?? new Set(input.orderedMatBouts.map((bout) => bout.id))
  const queue = buildMatQueue({
    bouts: input.orderedMatBouts,
    completedBoutIds: input.completedBoutIds,
    activeBoutId: null,
    restUntilByEntryId: input.restUntilByEntryId,
    now: input.now,
    skipRestBlocks: input.skipRestBlocks,
  })
  const firstInQueue =
    queue.nextAvailable?.bout.id ??
    input.orderedMatBouts.find((bout) => !input.completedBoutIds.has(bout.id))?.id ??
    null

  if (
    input.correctionFocusBoutId &&
    boutIdsOnMat.has(input.correctionFocusBoutId)
  ) {
    return input.correctionFocusBoutId
  }

  if (
    input.sessionActiveBoutId &&
    boutIdsOnMat.has(input.sessionActiveBoutId) &&
    !input.completedBoutIds.has(input.sessionActiveBoutId)
  ) {
    return input.sessionActiveBoutId
  }

  if (input.matInProgressBoutId && boutIdsOnMat.has(input.matInProgressBoutId)) {
    return input.matInProgressBoutId
  }

  return firstInQueue
}

export function buildMatQueue(input: {
  bouts: InternalBout[]
  completedBoutIds: Set<string>
  activeBoutId: string | null
  restUntilByEntryId: Map<string, Date>
  now: Date
  skipRestBlocks?: boolean
}): MatQueueSnapshot {
  const { bouts, completedBoutIds, activeBoutId, restUntilByEntryId, now } = input
  const boutIds = new Set(bouts.map((bout) => bout.id))
  const dependencyGraph = buildSportDependencyGraph(bouts, boutIds)

  const pending = bouts.filter(
    (bout) => !completedBoutIds.has(bout.id) && bout.id !== activeBoutId,
  )

  const entries: MatQueueEntry[] = pending.map((bout) =>
    buildMatQueueEntry({
      bout,
      dependencyGraph,
      completedBoutIds,
      restUntilByEntryId,
      now,
      skipRestBlocks: input.skipRestBlocks,
    }),
  )

  const available = entries.filter((entry) => !entry.blockedReason)
  const blocked = entries.filter((entry) => entry.blockedReason)

  return {
    nextAvailable: available[0] ?? null,
    upcoming: available,
    blocked,
  }
}

export function formatRestRemainingMs(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
