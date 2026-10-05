import { describe, expect, it } from 'vitest'
import { isValidSeedPosition, swapSeedPositions } from '../participantReorder'

const sample = [
  { entryId: 'a', seedPosition: 1 },
  { entryId: 'b', seedPosition: 2 },
  { entryId: 'c', seedPosition: 3 },
  { entryId: 'd', seedPosition: 4 },
]

describe('participantReorder', () => {
  it('swaps seed positions between two participants', () => {
    const result = swapSeedPositions(sample, 'a', 3)
    expect(result?.find((p) => p.entryId === 'a')?.seedPosition).toBe(3)
    expect(result?.find((p) => p.entryId === 'c')?.seedPosition).toBe(1)
    expect(result?.find((p) => p.entryId === 'b')?.seedPosition).toBe(2)
    expect(result?.find((p) => p.entryId === 'd')?.seedPosition).toBe(4)
  })

  it('returns null when target position is the same', () => {
    expect(swapSeedPositions(sample, 'b', 2)).toBeNull()
  })

  it('returns null when target position does not exist', () => {
    expect(swapSeedPositions(sample, 'a', 99)).toBeNull()
  })

  it('validates seed position range', () => {
    expect(isValidSeedPosition(1, 4)).toBe(true)
    expect(isValidSeedPosition(4, 4)).toBe(true)
    expect(isValidSeedPosition(0, 4)).toBe(false)
    expect(isValidSeedPosition(5, 4)).toBe(false)
    expect(isValidSeedPosition(1.5, 4)).toBe(false)
  })
})
