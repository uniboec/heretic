import { describe, expect, it } from 'vitest'
import { selectLiveWindowBouts } from '../selectLiveWindowBouts'
import type { BoutTiming } from '@/lib/bouts/scheduleTypes'

function bout(id: string, status: BoutTiming['status']) {
  return {
    id,
    timing: {
      status,
      durationMinutes: 3,
      scheduledStartAt: '2026-09-23T05:00:00.000Z',
      scheduledEndAt: '2026-09-23T05:03:00.000Z',
      estimatedStartAt: '2026-09-23T05:00:00.000Z',
      estimatedEndAt: '2026-09-23T05:03:00.000Z',
      delayMinutes: 0,
      isDelayed: false,
    } satisfies BoutTiming,
  }
}

describe('selectLiveWindowBouts', () => {
  it('returns all bouts when count fits window', () => {
    const bouts = [bout('1', 'upcoming'), bout('2', 'upcoming')]
    expect(selectLiveWindowBouts(bouts, 6)).toEqual({
      visible: bouts,
      hiddenCount: 0,
    })
  })

  it('windows around first non-completed bout', () => {
    const bouts = Array.from({ length: 10 }, (_, index) =>
      bout(String(index + 1), index < 4 ? 'completed' : 'upcoming'),
    )

    const result = selectLiveWindowBouts(bouts, 6)
    expect(result.visible.map((item) => item.id)).toEqual(['4', '5', '6', '7', '8', '9'])
    expect(result.hiddenCount).toBe(4)
  })
})
