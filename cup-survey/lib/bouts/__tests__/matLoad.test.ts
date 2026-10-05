import { describe, expect, it, vi } from 'vitest'
import * as boutDuration from '../boutDuration'
import {
  boutLoadWeight,
  createMatLoads,
  resolveBoutLoadMinutes,
  sumBoutLoads,
} from '../matLoad'

describe('matLoad', () => {
  const settings = {
    boutBreakMinutes: 3,
    ageDivisionDurationOverrides: {},
  }

  it('createMatLoads returns zeroed array', () => {
    expect(createMatLoads(3)).toEqual([0, 0, 0])
  })

  it('resolveBoutLoadMinutes adds break to duration', () => {
    vi.spyOn(boutDuration, 'resolveBoutDurationMinutes').mockReturnValue(5)
    expect(resolveBoutLoadMinutes({ categoryKey: 'cat:a' }, settings)).toBe(8)
    vi.restoreAllMocks()
  })

  it('sumBoutLoads sums the provided list without filtering', () => {
    vi.spyOn(boutDuration, 'resolveBoutDurationMinutes').mockReturnValue(2)
    const bouts = [
      { categoryKey: 'cat:a' },
      { categoryKey: 'cat:b' },
      { categoryKey: 'cat:c' },
    ]
    expect(sumBoutLoads(bouts, settings)).toBe(15)
    vi.restoreAllMocks()
  })

  it('boutLoadWeight uses minutes in time modes and 1 in count modes', () => {
    vi.spyOn(boutDuration, 'resolveBoutDurationMinutes').mockReturnValue(4)
    const bout = { categoryKey: 'cat:a' }
    expect(boutLoadWeight(bout, 'BY_BOUT_TIME', settings)).toBe(7)
    expect(boutLoadWeight(bout, 'BY_CATEGORY', settings)).toBe(1)
    vi.restoreAllMocks()
  })
})
