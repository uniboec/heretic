import type { InternalBout } from './types'

export type SportDependencyGraph = {
  predecessors: Map<string, Set<string>>
  successors: Map<string, Set<string>>
}

function addEdge(graph: SportDependencyGraph, from: string, to: string): void {
  if (from === to) return
  if (!graph.predecessors.has(to)) graph.predecessors.set(to, new Set())
  graph.predecessors.get(to)!.add(from)
  if (!graph.successors.has(from)) graph.successors.set(from, new Set())
  graph.successors.get(from)!.add(to)
}

function resolveFeederBoutId(bout: InternalBout, matchId: string): string | null {
  return `${bout.categoryKey}::${matchId}`
}

function collectFeederIds(bout: InternalBout): string[] {
  const ids: string[] = []
  for (const side of [bout.sideA, bout.sideB]) {
    if (side.kind === 'hint' && side.source?.matchId) {
      ids.push(resolveFeederBoutId(bout, side.source.matchId))
    }
  }
  return ids
}

export function buildSportDependencyGraph(
  bouts: InternalBout[],
  boutIds: Set<string>,
): SportDependencyGraph {
  const graph: SportDependencyGraph = {
    predecessors: new Map(),
    successors: new Map(),
  }

  for (const bout of bouts) {
    for (const feederId of collectFeederIds(bout)) {
      if (boutIds.has(feederId)) {
        addEdge(graph, feederId, bout.id)
      }
    }

    if (bout.schedulePhase === 'bronze') {
      for (const side of [bout.sideA, bout.sideB]) {
        if (
          side.kind === 'hint' &&
          side.source?.matchId &&
          side.source.outcome === 'loser'
        ) {
          const feederId = resolveFeederBoutId(bout, side.source.matchId)
          if (boutIds.has(feederId)) addEdge(graph, feederId, bout.id)
        }
      }
    }
  }

  return graph
}

export function sportPredecessors(
  graph: SportDependencyGraph,
  boutId: string,
): string[] {
  return [...(graph.predecessors.get(boutId) ?? [])]
}

export function resolveDownstreamBoutIds(boutId: string, bouts: InternalBout[]): string[] {
  const boutIds = new Set(bouts.map((bout) => bout.id))
  const graph = buildSportDependencyGraph(bouts, boutIds)
  const closure = sportDescendantClosure([boutId], graph)
  closure.delete(boutId)
  return [...closure]
}

export function sportDescendantClosure(
  seedIds: Iterable<string>,
  graph: SportDependencyGraph,
): Set<string> {
  const closure = new Set<string>()
  const queue = [...seedIds]
  while (queue.length > 0) {
    const id = queue.pop()!
    if (closure.has(id)) continue
    closure.add(id)
    for (const succ of graph.successors.get(id) ?? []) {
      if (!closure.has(succ)) queue.push(succ)
    }
  }
  return closure
}

export function sportPredecessorsScheduled(
  boutId: string,
  graph: SportDependencyGraph,
  plannedEndAtByBout: Map<string, Date>,
): boolean {
  return sportPredecessors(graph, boutId).every((pred) => plannedEndAtByBout.has(pred))
}
