import type { InternalBout } from './types'
import type { BoutScheduleOverrides } from './scheduleOverrides'
import { collectCandidatePolicyEdges } from './schedulePolicy'
import type { SportDependencyGraph } from './sportDependencies'
import { InvalidScheduleInvariantError, ScheduleConstraintCycleError } from './errors'

export type ScheduleConstraintEdgeKind = 'sport' | 'manual' | 'pinned' | 'policy'

export type ScheduleConstraintEdge = {
  from: string
  to: string
  kind: ScheduleConstraintEdgeKind
}

export type ScheduleConstraintGraph = {
  edges: ScheduleConstraintEdge[]
  predecessors: Map<string, ScheduleConstraintEdge[]>
  successors: Map<string, ScheduleConstraintEdge[]>
}

export type Partition = 'automatic' | 'pinned'

export function effectivePinnedPartition(
  bout: InternalBout,
  overrides: BoutScheduleOverrides,
  pinAllFinalsToEnd: boolean,
  pinnedClosure: Set<string>,
): Partition {
  const explicit =
    overrides[bout.id]?.pinnedToEnd === true ||
    (pinAllFinalsToEnd && bout.schedulePhase === 'final') ||
    pinnedClosure.has(bout.id)
  return explicit ? 'pinned' : 'automatic'
}

function addEdge(graph: ScheduleConstraintGraph, edge: ScheduleConstraintEdge): void {
  graph.edges.push(edge)
  if (!graph.predecessors.has(edge.to)) graph.predecessors.set(edge.to, [])
  graph.predecessors.get(edge.to)!.push(edge)
  if (!graph.successors.has(edge.from)) graph.successors.set(edge.from, [])
  graph.successors.get(edge.from)!.push(edge)
}

function emptyGraph(): ScheduleConstraintGraph {
  return { edges: [], predecessors: new Map(), successors: new Map() }
}

function assertSameStageEdge(
  from: InternalBout,
  to: InternalBout,
  kind: ScheduleConstraintEdgeKind,
): void {
  if (from.competitionStage !== to.competitionStage) {
    throw new InvalidScheduleInvariantError(
      `${kind} edge crosses stages: ${from.id} (S${from.competitionStage}) → ${to.id} (S${to.competitionStage})`,
    )
  }
}

function wouldCreateCycle(graph: ScheduleConstraintGraph, from: string, to: string): boolean {
  const visited = new Set<string>()
  const stack = [to]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (node === from) return true
    if (visited.has(node)) continue
    visited.add(node)
    for (const edge of graph.successors.get(node) ?? []) {
      stack.push(edge.to)
    }
  }
  return false
}

function assertAcyclic(graph: ScheduleConstraintGraph, label: string): void {
  const indegree = new Map<string, number>()
  const nodes = new Set<string>()
  for (const edge of graph.edges) {
    nodes.add(edge.from)
    nodes.add(edge.to)
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
    if (!indegree.has(edge.from)) indegree.set(edge.from, 0)
  }
  const queue = [...nodes].filter((n) => (indegree.get(n) ?? 0) === 0)
  let visited = 0
  while (queue.length > 0) {
    const node = queue.shift()!
    visited++
    for (const edge of graph.successors.get(node) ?? []) {
      const next = (indegree.get(edge.to) ?? 0) - 1
      indegree.set(edge.to, next)
      if (next === 0) queue.push(edge.to)
    }
  }
  if (visited !== nodes.size) {
    throw new ScheduleConstraintCycleError(`Schedule constraint cycle detected (${label})`)
  }
}

function buildManualQueuesPerStageMatPartition(input: {
  boutsByMat: Map<number, InternalBout[]>
  overrides: BoutScheduleOverrides
  partitions: Map<string, Partition>
}): Map<string, InternalBout[]> {
  const queues = new Map<string, InternalBout[]>()
  for (const [matIndex, bouts] of input.boutsByMat) {
    const stages = [...new Set(bouts.map((b) => b.competitionStage))]
    for (const stage of stages) {
      const stageBouts = bouts.filter((b) => b.competitionStage === stage)
      for (const partition of ['automatic', 'pinned'] as Partition[]) {
        const queue = stageBouts
          .filter((b) => input.partitions.get(b.id) === partition)
          .filter((b) => typeof input.overrides[b.id]?.manualOrder === 'number')
          .sort(
            (a, b) =>
              (input.overrides[a.id]!.manualOrder! - input.overrides[b.id]!.manualOrder!) ||
              a.id.localeCompare(b.id),
          )
        if (queue.length > 0) queues.set(`${stage}:${matIndex}:${partition}`, queue)
      }
    }
  }
  return queues
}

export function buildScheduleConstraintGraph(input: {
  bouts: InternalBout[]
  boutsByMat: Map<number, InternalBout[]>
  sportGraph: SportDependencyGraph
  overrides: BoutScheduleOverrides
  pinAllFinalsToEnd: boolean
  pinnedClosure: Set<string>
  partitions: Map<string, Partition>
}): ScheduleConstraintGraph {
  const graph = emptyGraph()
  const boutById = new Map(input.bouts.map((b) => [b.id, b]))

  for (const bout of input.bouts) {
    for (const pred of input.sportGraph.predecessors.get(bout.id) ?? []) {
      const from = boutById.get(pred)!
      assertSameStageEdge(from, bout, 'sport')
      addEdge(graph, { from: pred, to: bout.id, kind: 'sport' })
    }
  }

  for (const [matIndex, bouts] of input.boutsByMat) {
    const stages = [...new Set(bouts.map((b) => b.competitionStage))]
    for (const stage of stages) {
      const stageBouts = bouts.filter((b) => b.competitionStage === stage)
      const automatic = stageBouts.filter((b) => input.partitions.get(b.id) === 'automatic')
      const pinned = stageBouts.filter((b) => input.partitions.get(b.id) === 'pinned')
      for (const auto of automatic) {
        for (const pin of pinned) {
          assertSameStageEdge(auto, pin, 'pinned')
          addEdge(graph, { from: auto.id, to: pin.id, kind: 'pinned' })
        }
      }
    }
  }

  const manualQueues = buildManualQueuesPerStageMatPartition({
    boutsByMat: input.boutsByMat,
    overrides: input.overrides,
    partitions: input.partitions,
  })
  for (const queue of manualQueues.values()) {
    for (let i = 0; i < queue.length - 1; i++) {
      const from = queue[i]!
      const to = queue[i + 1]!
      assertSameStageEdge(from, to, 'manual')
      addEdge(graph, { from: from.id, to: to.id, kind: 'manual' })
    }
  }

  assertAcyclic(graph, 'base')

  for (const candidate of collectCandidatePolicyEdges(input.bouts)) {
    const from = boutById.get(candidate.from)!
    const to = boutById.get(candidate.to)!
    assertSameStageEdge(from, to, 'policy')
    if (!wouldCreateCycle(graph, candidate.from, candidate.to)) {
      addEdge(graph, { from: candidate.from, to: candidate.to, kind: 'policy' })
    }
  }

  return graph
}

export function assertScheduleConstraintGraphAcyclic(graph: ScheduleConstraintGraph): void {
  assertAcyclic(graph, 'final')
}

export function activePolicyPredecessorsFromGraph(
  boutId: string,
  graph: ScheduleConstraintGraph,
): string[] {
  return (graph.predecessors.get(boutId) ?? [])
    .filter((edge) => edge.kind === 'policy')
    .map((edge) => edge.from)
}
