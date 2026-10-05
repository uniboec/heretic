import { describe, expect, it } from 'vitest'
import { buildScheduleOverridesFromPairs } from '../schedulePipeline'
import { pruneStaleScheduleOverrides } from '../scheduleOverrides'
import { makeTestBout } from './testBoutHelpers'

describe('scheduleOverrides', () => {
  it('pruneStaleScheduleOverrides drops bout ids absent from current schedule', () => {
    const pruned = pruneStaleScheduleOverrides(
      {
        'cat:a::old': { manualOrder: 0 },
        'cat:a::live': { pinnedToEnd: true },
      },
      new Set(['cat:a::live']),
    )
    expect(pruned).toEqual({ 'cat:a::live': { pinnedToEnd: true } })
  })

  it('pruneStaleScheduleOverrides drops stale queue-after anchors', () => {
    const pruned = pruneStaleScheduleOverrides(
      {
        'cat:a::live': { queueAfterBoutId: 'cat:a::old' },
      },
      new Set(['cat:a::live']),
    )
    expect(pruned).toEqual({})
  })

  it('buildScheduleOverridesFromPairs prunes stale keys after grouped bout set shrinks', () => {
    const bout = makeTestBout({ id: 'cat:a::live', categoryKey: 'cat:a' })
    const grouped = { mats: [{ matIndex: 1, bouts: [bout] }], warnings: [] }
    const pairs = [
      {
        draw: { categoryKey: 'cat:a' },
        publicationState: {
          scheduleOverrides: {
            'cat:a::old': { manualOrder: 1 },
            'cat:a::live': { manualOrder: 0 },
          },
        },
      },
    ] as never
    const overrides = buildScheduleOverridesFromPairs(pairs, grouped)
    expect(overrides['cat:a::old']).toBeUndefined()
    expect(overrides['cat:a::live']?.manualOrder).toBe(0)
  })
})
