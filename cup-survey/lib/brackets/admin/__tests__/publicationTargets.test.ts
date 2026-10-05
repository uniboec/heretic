import { describe, expect, it } from 'vitest'
import {
  isCategoryReadyForBoutRelease,
  isCategoryReadyForPublication,
  isCategoryReadyForScheduleRelease,
  resolveVisibilityTargetPairs,
} from '../publicationTargets'

const readyChampion = {
  status: 'ACTIVE',
  autoSystemId: 'champion',
  systemOverride: null,
  participantCount: 1,
  compositionStale: false,
  seedingStale: false,
  balanceStale: false,
}

const readyOlympic = {
  ...readyChampion,
  autoSystemId: 'olympic',
  participantCount: 2,
}

describe('resolveVisibilityTargetPairs', () => {
  const pairs = [
    {
      draw: { categoryKey: 'cat:a', status: 'ACTIVE', title: 'A' },
      publicationState: { visible: false },
    },
    {
      draw: { categoryKey: 'cat:b', status: 'ACTIVE', title: 'B' },
      publicationState: { visible: false },
    },
    {
      draw: { categoryKey: 'cat:c', status: 'UNSUPPORTED', title: 'C' },
      publicationState: { visible: false },
    },
  ] as never[]

  it('returns one category for category scope', () => {
    const result = resolveVisibilityTargetPairs({
      scope: 'category',
      categoryKey: 'cat:b',
      visible: true,
      currentPairs: pairs,
    })
    expect(result.map((pair) => pair.draw.categoryKey)).toEqual(['cat:b'])
  })

  it('returns all active categories for global show', () => {
    const result = resolveVisibilityTargetPairs({
      scope: 'all',
      visible: true,
      currentPairs: pairs,
    })
    expect(result.map((pair) => pair.draw.categoryKey)).toEqual(['cat:a', 'cat:b'])
  })

  it('returns all categories for global hide', () => {
    const result = resolveVisibilityTargetPairs({
      scope: 'all',
      visible: false,
      currentPairs: pairs,
    })
    expect(result.map((pair) => pair.draw.categoryKey)).toEqual(['cat:a', 'cat:b', 'cat:c'])
  })
})

describe('publicationTargets split', () => {
  it('allows champion on site eligibility', () => {
    expect(isCategoryReadyForPublication(readyChampion, false)).toBe(true)
  })

  it('excludes champion from bout release eligibility', () => {
    expect(isCategoryReadyForBoutRelease(readyChampion, false)).toBe(false)
  })

  it('allows olympic pairs in bout release', () => {
    expect(isCategoryReadyForBoutRelease(readyOlympic, false)).toBe(true)
  })

  it('includes champion in schedule release', () => {
    expect(isCategoryReadyForScheduleRelease(readyChampion, false)).toBe(true)
  })

  it('includes olympic pairs in schedule release', () => {
    expect(isCategoryReadyForScheduleRelease(readyOlympic, false)).toBe(true)
  })
})
