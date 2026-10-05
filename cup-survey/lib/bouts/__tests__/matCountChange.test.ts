import { describe, expect, it, vi } from 'vitest'
import * as boutDuration from '../boutDuration'
import * as extractForPair from '../extractForPair'
import { assignByCategory } from '../autoMatAssign'
import { boutLoadWeight, createMatLoads } from '../matLoad'
import { accumulateReleasedLoad } from '../releasedLoad'
import { computeDemotionToken } from '../matCountChange'
import { toPlayableBouts } from '../toPlayableBouts'
import type { PublishedDrawPair } from '../../brackets/generation/publishedDraws'
import { makeTestBout } from './testBoutHelpers'

function athleteSide(entryId: string) {
  return {
    kind: 'athlete' as const,
    entryId,
    displayName: entryId,
    clubName: '',
    city: '',
    publicNumber: null,
  }
}

function makeBout(id: string, categoryKey: string) {
  return makeTestBout({
    id,
    categoryKey,
    categoryTitle: categoryKey,
    discipline: 'grappling',
    storedMatIndex: null,
    schedulePhase: 'elimination',
    round: 1,
    roundsUntilFinal: 1,
    sideA: athleteSide(`a-${id}`),
    sideB: athleteSide(`b-${id}`),
  })
}

function makeFixedPair(categoryKey: string, matIndex: number, boutCount: number): PublishedDrawPair {
  return {
    draw: {
      id: `draw-${categoryKey}`,
      categoryKey,
      matIndex,
      participants: Array.from({ length: boutCount * 2 }, (_, index) => ({
        entryId: `entry-${index}`,
        seedPosition: index + 1,
      })),
      status: 'ACTIVE',
      autoSystemId: null,
      systemOverride: null,
    },
    publicationState: {
      categoryKey,
      boutsReleased: true,
      boutMatAssignments: null,
      matCountAtRelease: 2,
      publishedDrawId: `draw-${categoryKey}`,
    },
  } as unknown as PublishedDrawPair
}

describe('computeDemotionToken', () => {
  it('includes newMatCount in fingerprint', () => {
    const base = {
      draftId: 'draft-1',
      draftVersion: 3,
      activePublishedGenerationId: 'pub-1',
      draftEntries: [{ categoryKey: 'cat-a', matIndex: 3, drawId: 'd1' }],
      publishedEntries: [] as Array<{ categoryKey: string; matIndex: number; drawId: string }>,
    }
    const tokenForTwo = computeDemotionToken({ ...base, newMatCount: 2 })
    const tokenForOne = computeDemotionToken({ ...base, newMatCount: 1 })
    expect(tokenForTwo).not.toBe(tokenForOne)
  })

  it('sorts entries deterministically', () => {
    const token = computeDemotionToken({
      draftId: 'draft-1',
      draftVersion: 1,
      activePublishedGenerationId: null,
      newMatCount: 2,
      draftEntries: [
        { categoryKey: 'b-cat', matIndex: 3, drawId: 'd2' },
        { categoryKey: 'a-cat', matIndex: 3, drawId: 'd1' },
      ],
      publishedEntries: [],
    })
    const tokenReordered = computeDemotionToken({
      draftId: 'draft-1',
      draftVersion: 1,
      activePublishedGenerationId: null,
      newMatCount: 2,
      draftEntries: [
        { categoryKey: 'a-cat', matIndex: 3, drawId: 'd1' },
        { categoryKey: 'b-cat', matIndex: 3, drawId: 'd2' },
      ],
      publishedEntries: [],
    })
    expect(token).toBe(tokenReordered)
  })
})

describe('matCountChange load invariants', () => {
  it('BYE bouts are excluded from Fixed priming weight', () => {
    const settings = { boutBreakMinutes: 0, ageDivisionDurationOverrides: {} }
    const pair = makeFixedPair('fixed', 1, 4)
    const extracted = [
      makeBout('play-1', 'fixed'),
      makeBout('play-2', 'fixed'),
      {
        ...makeBout('bye-1', 'fixed'),
        sideB: { kind: 'bye' as const },
      },
    ]
    vi.spyOn(extractForPair, 'extractPlayableBoutsForPair').mockReturnValue(extracted)

    const playable = toPlayableBouts(extracted, pair.draw.participants.length)
    expect(playable).toHaveLength(2)

    const loads = createMatLoads(2)
    accumulateReleasedLoad([pair], 2, loads, 'BY_CATEGORY', settings)
    expect(loads).toEqual([2, 0])

    vi.restoreAllMocks()
  })

  it('Fixed priming switches metric on mode change count → time', () => {
    const settings = { boutBreakMinutes: 0, ageDivisionDurationOverrides: {} }
    const pair = makeFixedPair('fixed', 1, 4)
    vi.spyOn(extractForPair, 'extractPlayableBoutsForPair').mockReturnValue([
      makeBout('b1', 'fixed'),
      makeBout('b2', 'fixed'),
      makeBout('b3', 'fixed'),
      makeBout('b4', 'fixed'),
    ])
    vi.spyOn(boutDuration, 'resolveBoutDurationMinutes').mockReturnValue(10)

    const countLoads = createMatLoads(2)
    accumulateReleasedLoad([pair], 2, countLoads, 'BY_CATEGORY', settings)
    expect(countLoads).toEqual([4, 0])

    const timeLoads = createMatLoads(2)
    accumulateReleasedLoad([pair], 2, timeLoads, 'BY_CATEGORY_TIME', settings)
    expect(timeLoads).toEqual([40, 0])

    vi.restoreAllMocks()
  })

  it('reassign path: Fixed priming + Auto batch does not double-count Fixed', () => {
    const settings = { boutBreakMinutes: 0, ageDivisionDurationOverrides: {} }
    const fixedPair = makeFixedPair('fixed', 1, 3)
    vi.spyOn(extractForPair, 'extractPlayableBoutsForPair').mockImplementation((pair) => {
      if (pair.draw.categoryKey === 'fixed') {
        return [makeBout('f1', 'fixed'), makeBout('f2', 'fixed'), makeBout('f3', 'fixed')]
      }
      return [makeBout('a1', 'auto'), makeBout('a2', 'auto'), makeBout('a3', 'auto')]
    })

    const loads = createMatLoads(2)
    accumulateReleasedLoad([fixedPair], 2, loads, 'BY_CATEGORY', settings)
    expect(loads).toEqual([3, 0])

    const weightFn = (bout: { categoryKey: string }) => boutLoadWeight(bout, 'BY_CATEGORY', settings)
    assignByCategory(
      [makeBout('a1', 'auto'), makeBout('a2', 'auto'), makeBout('a3', 'auto')],
      loads,
      weightFn,
    )
    expect(loads).toEqual([3, 3])

    const doubleCountLoads = createMatLoads(2)
    accumulateReleasedLoad([fixedPair], 2, doubleCountLoads, 'BY_CATEGORY', settings)
    accumulateReleasedLoad([fixedPair], 2, doubleCountLoads, 'BY_CATEGORY', settings)
    expect(doubleCountLoads).toEqual([6, 0])

    vi.restoreAllMocks()
  })
})
