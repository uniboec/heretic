import type { InternalBout } from './types'
import type { ScheduleConstraintGraph } from './scheduleConstraintGraph'
import { activePolicyPredecessorsFromGraph } from './scheduleConstraintGraph'

export type PolicyCandidateEdge = {
  from: string
  to: string
  categoryKey: string
}

export function collectCandidatePolicyEdges(bouts: InternalBout[]): PolicyCandidateEdge[] {
  const bronzeByCategory = new Map<string, string>()
  const finalsByCategory = new Map<string, string[]>()

  for (const bout of bouts) {
    if (bout.schedulePhase === 'bronze') bronzeByCategory.set(bout.categoryKey, bout.id)
    if (bout.schedulePhase === 'final') {
      const list = finalsByCategory.get(bout.categoryKey) ?? []
      list.push(bout.id)
      finalsByCategory.set(bout.categoryKey, list)
    }
  }

  const edges: PolicyCandidateEdge[] = []
  for (const [categoryKey, bronzeId] of bronzeByCategory) {
    for (const finalId of finalsByCategory.get(categoryKey) ?? []) {
      edges.push({ from: bronzeId, to: finalId, categoryKey })
    }
  }

  return edges.sort((a, b) => {
    const keyCompare = a.categoryKey.localeCompare(b.categoryKey)
    if (keyCompare !== 0) return keyCompare
    const fromCompare = a.from.localeCompare(b.from)
    if (fromCompare !== 0) return fromCompare
    return a.to.localeCompare(b.to)
  })
}

export function activePolicyPredecessors(
  boutId: string,
  graph: ScheduleConstraintGraph,
): string[] {
  return activePolicyPredecessorsFromGraph(boutId, graph)
}

export function activePolicyPredecessorsScheduled(
  boutId: string,
  graph: ScheduleConstraintGraph,
  plannedEndAtByBout: Map<string, Date>,
): boolean {
  return activePolicyPredecessors(boutId, graph).every((pred) => plannedEndAtByBout.has(pred))
}
