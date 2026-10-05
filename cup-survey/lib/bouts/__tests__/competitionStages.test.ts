import { describe, expect, it } from 'vitest'
import {
  MAX_COMPETITION_STAGE,
  collectConfiguredCategoryStages,
  collectScheduledUsedStages,
  previousUsedStage,
  resolveStageUiRange,
  stageGapMinutes,
} from '../competitionStages'
import { EMPTY_COMPETITION_STAGE_SETTINGS } from '../competitionStageSettings'

describe('competitionStages helpers', () => {
  it('collectScheduledUsedStages returns sorted unique stages', () => {
    expect(
      collectScheduledUsedStages([
        { competitionStage: 3 },
        { competitionStage: 1 },
        { competitionStage: 3 },
      ]),
    ).toEqual([1, 3])
  })

  it('previousUsedStage skips empty configured stages', () => {
    const used = [1, 3]
    expect(previousUsedStage(3, used)).toBe(1)
    expect(previousUsedStage(1, used)).toBeNull()
  })

  it('resolveStageUiRange caps maxSelectable at MAX_COMPETITION_STAGE', () => {
    const range = resolveStageUiRange({
      configuredCategoryStages: [MAX_COMPETITION_STAGE],
      stageSettings: EMPTY_COMPETITION_STAGE_SETTINGS,
    })
    expect(range.maxSelectable).toBe(MAX_COMPETITION_STAGE)
    expect(range.maxDisplay).toBe(MAX_COMPETITION_STAGE)
  })

  it('stageGapMinutes uses max of bout break and stage break', () => {
    expect(
      stageGapMinutes(
        1,
        { breaksAfterStageMinutes: { '1': 10 }, notBeforeStartTimes: {} },
        3,
      ),
    ).toBe(10)
    expect(
      stageGapMinutes(
        1,
        { breaksAfterStageMinutes: { '1': 0 }, notBeforeStartTimes: {} },
        3,
      ),
    ).toBe(3)
  })

  it('collectConfiguredCategoryStages mirrors draw configuration', () => {
    expect(
      collectConfiguredCategoryStages([
        { competitionStage: 2 },
        { competitionStage: 1 },
        { competitionStage: 2 },
      ]),
    ).toEqual([1, 2])
  })
})
