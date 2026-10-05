import { describe, expect, it, vi } from 'vitest'
import * as boutDuration from '../boutDuration'
import * as extractForPair from '../extractForPair'
import {
  assignByBout,
  assignByCategory,
  pickLeastLoadedMat,
} from '../autoMatAssign'
import { boutLoadWeight, createMatLoads } from '../matLoad'
import { accumulateReleasedLoad } from '../releasedLoad'
import type { PublishedDrawPair } from '../../brackets/generation/publishedDraws'

function makeFixedPair(input: {
  categoryKey: string
  matIndex: number
  boutCount: number
}): PublishedDrawPair {
  return {
    draw: {
      id: `draw-${input.categoryKey}`,
      categoryKey: input.categoryKey,
      matIndex: input.matIndex,
      participants: Array.from({ length: input.boutCount * 2 }, (_, index) => ({
        entryId: `entry-${index}`,
        seedPosition: index + 1,
      })),
      status: 'ACTIVE',
      autoSystemId: null,
      systemOverride: null,
    },
    publicationState: {
      categoryKey: input.categoryKey,
      boutsReleased: true,
      boutMatAssignments: null,
      matCountAtRelease: 2,
      publishedDrawId: `draw-${input.categoryKey}`,
    },
  } as unknown as PublishedDrawPair
}

function mockPlayableBouts(categoryKey: string, boutCount: number) {
  return Array.from({ length: boutCount }, (_, index) => ({
    id: `${categoryKey}-${index}`,
    categoryKey,
    matIndex: null,
    matchNumber: index + 1,
    categoryTitle: categoryKey,
    sideA: { kind: 'athlete' as const, entryId: `a-${index}`, displayName: 'A' },
    sideB: { kind: 'athlete' as const, entryId: `b-${index}`, displayName: 'B' },
  }))
}

describe('release two-pass load balancing', () => {
  it('pass 2 BY_BOUT: Auto batch uses released Fixed load when assigning mats', () => {
    const counts = [6, 3, 3]
    const bouts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const assignments = assignByBout(bouts, counts, () => 1)

    expect(assignments).toEqual({ a: 2, b: 3, c: 2 })
    expect(counts).toEqual([6, 5, 4])
  })

  it('pass 2 BY_CATEGORY: entire Auto category lands on one least-loaded mat', () => {
    const counts = [6, 3, 3]
    const bouts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const { assignments, mat } = assignByCategory(bouts, counts, () => 1)

    expect(mat).toBe(2)
    expect(assignments).toEqual({ a: 2, b: 2, c: 2 })
    expect(counts).toEqual([6, 6, 3])
  })

  it('batch vs loads: released Fixed load is included before Auto release', () => {
    const releasedFixedLoad = [0, 3, 3]
    const batchLoads = [...releasedFixedLoad]
    const bouts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

    assignByBout(bouts, batchLoads, () => 1)

    expect(releasedFixedLoad).toEqual([0, 3, 3])
    expect(batchLoads).toEqual([3, 3, 3])
  })

  it('Fixed priming uses minutes in time mode reassign path', () => {
    const settings = { boutBreakMinutes: 0, ageDivisionDurationOverrides: {} }
    const fixedPair = makeFixedPair({
      categoryKey: 'fixed',
      matIndex: 1,
      boutCount: 4,
    })
    vi.spyOn(extractForPair, 'extractPlayableBoutsForPair').mockReturnValue(
      mockPlayableBouts('fixed', 4),
    )
    vi.spyOn(boutDuration, 'resolveBoutDurationMinutes').mockReturnValue(5)

    const loads = createMatLoads(2)
    accumulateReleasedLoad([fixedPair], 2, loads, 'BY_CATEGORY_TIME', settings)

    expect(loads).toEqual([20, 0])

    vi.restoreAllMocks()
  })

  it('reassign priming count→time: Fixed preload is in minutes not bout count', () => {
    const settings = { boutBreakMinutes: 0, ageDivisionDurationOverrides: {} }
    const fixedPair = makeFixedPair({
      categoryKey: 'fixed',
      matIndex: 1,
      boutCount: 5,
    })
    vi.spyOn(extractForPair, 'extractPlayableBoutsForPair').mockReturnValue(
      mockPlayableBouts('fixed', 5),
    )
    vi.spyOn(boutDuration, 'resolveBoutDurationMinutes').mockReturnValue(10)

    const countLoads = createMatLoads(2)
    accumulateReleasedLoad([fixedPair], 2, countLoads, 'BY_CATEGORY', settings)
    expect(countLoads).toEqual([5, 0])

    const timeLoads = createMatLoads(2)
    accumulateReleasedLoad([fixedPair], 2, timeLoads, 'BY_CATEGORY_TIME', settings)
    expect(timeLoads).toEqual([50, 0])

    vi.restoreAllMocks()
  })

  it('pickLeastLoadedMat tie-break uses lower mat index', () => {
    expect(pickLeastLoadedMat([3, 3, 3])).toBe(1)
  })

  it('reassign uses nextEffectiveMode metric for Fixed priming', () => {
    const settings = { boutBreakMinutes: 0, ageDivisionDurationOverrides: {} }
    const fixedPair = makeFixedPair({
      categoryKey: 'fixed',
      matIndex: 1,
      boutCount: 5,
    })
    vi.spyOn(extractForPair, 'extractPlayableBoutsForPair').mockReturnValue(
      mockPlayableBouts('fixed', 5),
    )
    vi.spyOn(boutDuration, 'resolveBoutDurationMinutes').mockReturnValue(10)

    const previousMetricLoads = createMatLoads(2)
    accumulateReleasedLoad([fixedPair], 2, previousMetricLoads, 'BY_CATEGORY', settings)

    const nextMetricLoads = createMatLoads(2)
    accumulateReleasedLoad([fixedPair], 2, nextMetricLoads, 'BY_CATEGORY_TIME', settings)

    expect(previousMetricLoads).toEqual([5, 0])
    expect(nextMetricLoads).toEqual([50, 0])

    const autoBouts = mockPlayableBouts('auto', 2)
    const weightFn = (bout: { categoryKey: string }) =>
      boutLoadWeight(bout, 'BY_CATEGORY_TIME', settings)
    assignByCategory(autoBouts, nextMetricLoads, weightFn)
    expect(nextMetricLoads[0]).toBe(50)
    expect(nextMetricLoads[1]).toBeGreaterThan(0)

    vi.restoreAllMocks()
  })

  it('reassign path does not add Fixed load twice', () => {
    const settings = { boutBreakMinutes: 0, ageDivisionDurationOverrides: {} }
    const fixedPair = makeFixedPair({
      categoryKey: 'fixed',
      matIndex: 1,
      boutCount: 6,
    })
    vi.spyOn(extractForPair, 'extractPlayableBoutsForPair').mockReturnValue(
      mockPlayableBouts('fixed', 6),
    )

    const reassignLoads = createMatLoads(2)
    accumulateReleasedLoad([fixedPair], 2, reassignLoads, 'BY_CATEGORY', settings)
    assignByCategory(mockPlayableBouts('auto', 3), reassignLoads, () => 1)

    const incrementalLoads = createMatLoads(2)
    accumulateReleasedLoad([fixedPair], 2, incrementalLoads, 'BY_CATEGORY', settings)
    assignByCategory(mockPlayableBouts('auto', 3), incrementalLoads, () => 1)

    expect(reassignLoads).toEqual(incrementalLoads)
    expect(reassignLoads).toEqual([6, 3])

    vi.restoreAllMocks()
  })

  it('excludeCategoryKeys skips current batch during incremental priming', () => {
    const settings = { boutBreakMinutes: 0, ageDivisionDurationOverrides: {} }
    const pair = makeFixedPair({
      categoryKey: 'in-batch',
      matIndex: 1,
      boutCount: 3,
    })
    vi.spyOn(extractForPair, 'extractPlayableBoutsForPair').mockReturnValue(
      mockPlayableBouts('in-batch', 3),
    )

    const loads = createMatLoads(2)
    accumulateReleasedLoad([pair], 2, loads, 'BY_CATEGORY', settings, new Set(['in-batch']))
    expect(loads).toEqual([0, 0])

    vi.restoreAllMocks()
  })
})
