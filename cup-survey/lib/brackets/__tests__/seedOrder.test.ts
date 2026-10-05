import { describe, expect, it } from 'vitest'
import { seedOrderForBracketSize } from '../core/seeding/clubSeparation'

describe('seedOrderForBracketSize', () => {
  it('uses standard single-elimination spread for power-of-two brackets', () => {
    expect(seedOrderForBracketSize(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
    expect(seedOrderForBracketSize(16)).toEqual([
      1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11,
    ])
  })

  it('keeps top seeds apart in first round for 14 athletes in B=16', () => {
    const order = seedOrderForBracketSize(16)
    const firstRoundPairs: Array<[number, number]> = []
    for (let i = 0; i < order.length; i += 2) {
      firstRoundPairs.push([order[i], order[i + 1]])
    }

    expect(firstRoundPairs[0]).toEqual([1, 16])
    expect(firstRoundPairs[1]).toEqual([8, 9])
    expect(firstRoundPairs.some(([a, b]) => a === 1 && b === 2)).toBe(false)
    expect(firstRoundPairs.some(([a, b]) => a === 1 && b === 3)).toBe(false)
  })
})
