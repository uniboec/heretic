import { BoutsValidationError } from './errors'
import type { BoutScheduleOverrides } from './scheduleOverrides'
import type { InternalBout } from './types'

function assertNoQueueAfterCycle(
  boutIds: Set<string>,
  overrides: BoutScheduleOverrides,
): void {
  for (const boutId of boutIds) {
    const visited = new Set<string>()
    let current: string | undefined = boutId
    while (current) {
      if (visited.has(current)) {
        throw new BoutsValidationError(
          'Нельзя перенести поединок: получился замкнутый порядок очереди на ковре',
        )
      }
      visited.add(current)
      const anchorId = overrides[current]?.queueAfterBoutId
      if (!anchorId || !boutIds.has(anchorId)) break
      current = anchorId
    }
  }
}

export function applyMatQueueAfterOverrides(
  baseOrder: InternalBout[],
  overrides: BoutScheduleOverrides,
): InternalBout[] {
  const boutIds = new Set(baseOrder.map((bout) => bout.id))
  const postponed = baseOrder.filter((bout) => {
    const anchorId = overrides[bout.id]?.queueAfterBoutId
    return anchorId != null && anchorId !== bout.id && boutIds.has(anchorId)
  })
  if (postponed.length === 0) return baseOrder

  assertNoQueueAfterCycle(boutIds, overrides)

  const postponedIds = new Set(postponed.map((bout) => bout.id))
  const baseIndex = new Map(baseOrder.map((bout, index) => [bout.id, index]))
  const staticOrder = baseOrder.filter((bout) => !postponedIds.has(bout.id))
  const postponedByAnchor = new Map<string, InternalBout[]>()

  for (const bout of postponed) {
    const anchorId = overrides[bout.id]!.queueAfterBoutId!
    const group = postponedByAnchor.get(anchorId) ?? []
    group.push(bout)
    postponedByAnchor.set(anchorId, group)
  }

  for (const group of postponedByAnchor.values()) {
    group.sort((left, right) => baseIndex.get(left.id)! - baseIndex.get(right.id)!)
  }

  const result: InternalBout[] = []

  function appendPostponedAfter(anchorId: string): void {
    const group = postponedByAnchor.get(anchorId)
    if (!group) return
    postponedByAnchor.delete(anchorId)
    for (const bout of group) {
      result.push(bout)
      appendPostponedAfter(bout.id)
    }
  }

  for (const bout of staticOrder) {
    result.push(bout)
    appendPostponedAfter(bout.id)
  }

  for (const group of postponedByAnchor.values()) {
    result.push(...group)
  }

  return result
}
