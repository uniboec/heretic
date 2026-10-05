import type { BoutMatAssignments } from './legacyReleaseGate'

export { getEffectiveAutoMatAssignMode, isCategoryBatchMode, isTimeWeightedMode } from './autoMatMode'
export type { AutoMatAssignMode } from './autoMatMode'

export function pickLeastLoadedMat(loads: number[]): number {
  let bestMat = 1
  let bestLoad = loads[0] ?? 0
  for (let index = 1; index < loads.length; index++) {
    if ((loads[index] ?? 0) < bestLoad) {
      bestLoad = loads[index] ?? 0
      bestMat = index + 1
    }
  }
  return bestMat
}

export type BoutWeightFn = (bout: { id: string }) => number

export function assignByCategory(
  bouts: Array<{ id: string }>,
  loads: number[],
  weightFn: BoutWeightFn,
): { assignments: BoutMatAssignments; mat: number } {
  const mat = pickLeastLoadedMat(loads)
  const assignments: BoutMatAssignments = {}
  let batchWeight = 0
  for (const bout of bouts) {
    assignments[bout.id] = mat
    batchWeight += weightFn(bout)
  }
  loads[mat - 1] += batchWeight
  return { assignments, mat }
}

export function assignByBout(
  bouts: Array<{ id: string }>,
  loads: number[],
  weightFn: BoutWeightFn,
): BoutMatAssignments {
  const assignments: BoutMatAssignments = {}
  for (const bout of bouts) {
    const mat = pickLeastLoadedMat(loads)
    assignments[bout.id] = mat
    loads[mat - 1] += weightFn(bout)
  }
  return assignments
}

/** @deprecated Use assignByCategory */
export function assignAutoCategoryByCategory(
  bouts: Array<{ id: string }>,
  loads: number[],
): { assignments: BoutMatAssignments; mat: number } {
  return assignByCategory(bouts, loads, () => 1)
}

/** @deprecated Use assignByBout */
export function assignAutoCategoryByBout(
  bouts: Array<{ id: string }>,
  loads: number[],
): BoutMatAssignments {
  return assignByBout(bouts, loads, () => 1)
}
