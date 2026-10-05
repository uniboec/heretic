import { describe, expect, it } from 'vitest'
import { buildPlacementRows } from '../placements'

describe('buildPlacementRows', () => {
  it('creates four placements for olympic two bronze', () => {
    const rows = buildPlacementRows({
      result: {
        status: 'complete',
        placements: [
          { entryId: 'a', placement: 1, reason: 'FINAL_WINNER' },
          { entryId: 'b', placement: 2, reason: 'FINAL_LOSER' },
          { entryId: 'c', placement: 3, reason: 'BRONZE_TWO' },
          { entryId: 'd', placement: 3, reason: 'BRONZE_TWO' },
        ],
      },
      participants: [
        { entryId: 'a', displayName: 'Иванов Иван', clubName: 'Клуб 1' },
        { entryId: 'b', displayName: 'Петров Пётр', clubName: 'Клуб 2' },
        { entryId: 'c', displayName: 'Сидоров Сидор', clubName: 'Клуб 3' },
        { entryId: 'd', displayName: 'Козлов Козьма', clubName: 'Клуб 4' },
      ],
    })

    expect(rows).toHaveLength(4)
    expect(rows.map((row) => row.placementIndex)).toEqual([0, 1, 2, 3])
    expect(rows.map((row) => row.placement)).toEqual([1, 2, 3, 3])
  })

  it('creates one placement for champion category', () => {
    const rows = buildPlacementRows({
      result: {
        status: 'complete',
        placements: [{ entryId: 'solo', placement: 1, reason: 'FINAL_WINNER' }],
      },
      participants: [{ entryId: 'solo', displayName: 'Один Один', clubName: 'Клуб' }],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.placementIndex).toBe(0)
  })

  it('sorts standard podium by placement and placementIndex', () => {
    const rows = buildPlacementRows({
      result: {
        status: 'complete',
        placements: [
          { entryId: 'gold', placement: 1, reason: 'FINAL_WINNER' },
          { entryId: 'silver', placement: 2, reason: 'FINAL_LOSER' },
          { entryId: 'bronze', placement: 3, reason: 'BRONZE_WINNER' },
        ],
      },
      participants: [
        { entryId: 'gold', displayName: 'A A', clubName: 'C1' },
        { entryId: 'silver', displayName: 'B B', clubName: 'C2' },
        { entryId: 'bronze', displayName: 'C C', clubName: 'C3' },
      ],
    })

    expect(rows.map((row) => row.entryId)).toEqual(['gold', 'silver', 'bronze'])
  })
})
