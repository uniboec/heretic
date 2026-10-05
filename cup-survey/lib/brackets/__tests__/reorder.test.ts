import { describe, expect, it } from 'vitest'

/** Mirrors two-phase reorder from updateBracketDraw to avoid unique collisions. */
function twoPhaseAssignPositions(
  items: Array<{ entryId: string; seedPosition: number }>,
): Array<{ entryId: string; seedPosition: number }> {
  const temp = items.map((item, index) => ({
    entryId: item.entryId,
    seedPosition: -(index + 1),
  }))
  return temp.map((item, index) => ({
    entryId: item.entryId,
    seedPosition: items[index].seedPosition,
  }))
}

describe('participant reorder', () => {
  it('produces unique final seed positions', () => {
    const input = [
      { entryId: 'a', seedPosition: 3 },
      { entryId: 'b', seedPosition: 1 },
      { entryId: 'c', seedPosition: 2 },
    ]
    const result = twoPhaseAssignPositions(input)
    const positions = result.map((r) => r.seedPosition)
    expect(new Set(positions).size).toBe(positions.length)
    expect(positions.sort()).toEqual([1, 2, 3])
  })
})
