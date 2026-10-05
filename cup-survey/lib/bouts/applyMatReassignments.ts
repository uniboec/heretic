import type { BoutScheduleOverrides } from './scheduleOverrides'
import type { GroupedBoutsResult, InternalMatGroup } from './types'

export function applyMatReassignmentsFromOverrides(
  grouped: GroupedBoutsResult,
  overrides: BoutScheduleOverrides,
  matCount: number,
): GroupedBoutsResult {
  const reassignments = new Map<string, number>()
  for (const [boutId, override] of Object.entries(overrides)) {
    const targetMat = override.assignedMatIndex
    if (typeof targetMat === 'number' && targetMat >= 1 && targetMat <= matCount) {
      reassignments.set(boutId, targetMat)
    }
  }
  if (reassignments.size === 0) {
    return grouped
  }

  const effectiveMatCount = Math.max(matCount, grouped.mats.length, ...reassignments.values())
  const matMap = new Map<number, GroupedBoutsResult['mats'][number]['bouts']>()
  for (let matIndex = 1; matIndex <= effectiveMatCount; matIndex += 1) {
    matMap.set(matIndex, [])
  }

  for (const mat of grouped.mats) {
    for (const bout of mat.bouts) {
      const targetMat = reassignments.get(bout.id) ?? mat.matIndex
      const list = matMap.get(targetMat) ?? []
      list.push(bout)
      matMap.set(targetMat, list)
    }
  }

  const mats: InternalMatGroup[] = []
  for (let matIndex = 1; matIndex <= effectiveMatCount; matIndex += 1) {
    mats.push({
      matIndex,
      bouts: matMap.get(matIndex) ?? [],
    })
  }

  return { mats, warnings: grouped.warnings }
}
