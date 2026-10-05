import { describe, expect, it } from 'vitest'
import {
  assignScheduleWavesFromPlans,
  isWavePassed,
  reassignWavesForPendingBouts,
} from '../scheduleWaves'
import { makeTestBout } from './testBoutHelpers'

describe('scheduleWaves', () => {
  it('groups parallel starts into one wave', () => {
    const boutA = makeTestBout({ id: 'a', categoryKey: 'cat-a' })
    const boutB = makeTestBout({ id: 'b', categoryKey: 'cat-b' })
    const start = new Date('2026-10-03T10:00:00.000Z')
    const plans = new Map([
      [
        1,
        [
          {
            bout: boutA,
            matIndex: 1,
            plannedStartAt: start,
            plannedEndAt: new Date(start.getTime() + 180_000),
          },
        ],
      ],
      [
        2,
        [
          {
            bout: boutB,
            matIndex: 2,
            plannedStartAt: start,
            plannedEndAt: new Date(start.getTime() + 180_000),
          },
        ],
      ],
    ])

    const waves = assignScheduleWavesFromPlans(plans)
    expect(waves.a).toBe(waves.b)
  })

  it('reassignWavesForPending updates only pending bout waves', () => {
    const next = reassignWavesForPendingBouts({
      pendingBoutIds: ['b', 'c'],
      moves: [{ boutId: 'b', newWave: 13 }, { boutId: 'locked', newWave: 99 }],
      waves: { a: 10, b: 11, c: 12 },
    })
    expect(next).toEqual({ a: 10, b: 13, c: 12 })
  })

  it('isWavePassed when all bouts in wave are completed', () => {
    const passed = isWavePassed(2, [
      { boutId: 'a', scheduleWave: 2, lifecycle: 'COMPLETED' },
      { boutId: 'b', scheduleWave: 2, lifecycle: 'COMPLETED' },
      { boutId: 'c', scheduleWave: 3, lifecycle: 'PENDING' },
    ])
    expect(passed).toBe(true)
  })
})
