import type { BoutTiming } from '@/lib/bouts/scheduleTypes'

interface BoutWithTiming {
  id: string
  timing: BoutTiming
}

const DEFAULT_LIVE_WINDOW_SIZE = 6

export function selectLiveWindowBouts<T extends BoutWithTiming>(
  bouts: T[],
  windowSize = DEFAULT_LIVE_WINDOW_SIZE,
): { visible: T[]; hiddenCount: number } {
  if (bouts.length === 0) {
    return { visible: [], hiddenCount: 0 }
  }

  if (bouts.length <= windowSize) {
    return { visible: bouts, hiddenCount: 0 }
  }

  const focusIndex = Math.max(
    0,
    bouts.findIndex((bout) => bout.timing.status !== 'completed'),
  )
  const start = Math.max(0, focusIndex > 0 ? focusIndex - 1 : focusIndex)
  const end = Math.min(bouts.length, start + windowSize)
  const visible = bouts.slice(start, end)

  return {
    visible,
    hiddenCount: bouts.length - visible.length,
  }
}
