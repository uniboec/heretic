import type { BoutTiming } from './scheduleTypes'

type BoutWithTiming = {
  matIndex: number
  matchNumber: number
  timing?: Pick<BoutTiming, 'estimatedStartAt'>
}

function compareBoutsByTime(a: BoutWithTiming, b: BoutWithTiming): number {
  const aTime = a.timing?.estimatedStartAt
  const bTime = b.timing?.estimatedStartAt

  if (aTime && bTime) {
    const diff = aTime.localeCompare(bTime)
    if (diff !== 0) return diff
  } else if (aTime) {
    return -1
  } else if (bTime) {
    return 1
  }

  if (a.matIndex !== b.matIndex) return a.matIndex - b.matIndex
  return a.matchNumber - b.matchNumber
}

type BoutWithScheduleOrder = BoutWithTiming & {
  schedulePosition?: number
}

function compareBoutsByScheduleOrder(a: BoutWithScheduleOrder, b: BoutWithScheduleOrder): number {
  if (a.matIndex !== b.matIndex) return a.matIndex - b.matIndex
  const aPosition = a.schedulePosition ?? Number.MAX_SAFE_INTEGER
  const bPosition = b.schedulePosition ?? Number.MAX_SAFE_INTEGER
  if (aPosition !== bPosition) return aPosition - bPosition
  return compareBoutsByTime(a, b)
}

/** Flatten mats and sort bouts by queue position (mat, then schedule position). */
export function buildSchedulePositionSortedList<T extends BoutWithScheduleOrder>(
  mats: Array<{ matIndex: number; bouts: T[] }>,
): T[] {
  return mats.flatMap((mat) => mat.bouts).sort(compareBoutsByScheduleOrder)
}

/** Flatten all mats and sort bouts by estimated start time. */
export function buildTimeSortedScheduleList<T extends BoutWithTiming>(
  mats: Array<{ matIndex: number; bouts: T[] }>,
): T[] {
  return mats.flatMap((mat) => mat.bouts).sort(compareBoutsByTime)
}

/** Interleaves bouts across mats: mat1[0], mat2[0], …, mat1[1], mat2[1], … */
export function buildInterleavedScheduleList<T>(
  mats: Array<{ matIndex: number; bouts: T[] }>,
): T[] {
  if (mats.length === 0) return []
  const maxLen = Math.max(...mats.map((mat) => mat.bouts.length))
  const result: T[] = []
  for (let round = 0; round < maxLen; round++) {
    for (const mat of mats) {
      const bout = mat.bouts[round]
      if (bout) result.push(bout)
    }
  }
  return result
}
