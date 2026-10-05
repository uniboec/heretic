import { describe, expect, it } from 'vitest'
import {
  buildScheduleRowsWithStageDividers,
  shouldShowStageDividers,
} from '../stageScheduleDividers'

describe('stageScheduleDividers', () => {
  it('hides dividers when only stage 1 is used', () => {
    expect(shouldShowStageDividers([{ competitionStage: 1 }, { competitionStage: 1 }])).toBe(false)
    const rows = buildScheduleRowsWithStageDividers(
      [
        { id: 'a', competitionStage: 1 },
        { id: 'b', competitionStage: 1 },
      ],
      [],
    )
    expect(rows.every((row) => row.kind === 'bout')).toBe(true)
  })

  it('inserts divider when stage changes', () => {
    const rows = buildScheduleRowsWithStageDividers(
      [
        { id: 'a', competitionStage: 1 },
        { id: 'b', competitionStage: 2 },
      ],
      [
        {
          stage: 2,
          plannedStartAt: '2026-10-03T08:00:00.000Z',
          estimatedStartAt: '2026-10-03T08:20:00.000Z',
          delayMinutes: 20,
          isDelayed: true,
          gapAfterPreviousMinutes: 10,
        },
      ],
    )
    expect(rows.map((row) => row.kind)).toEqual(['bout', 'stage-divider', 'bout'])
  })
})
