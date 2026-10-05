import { canChangeCompetitionStage } from './competitionStageLifecycle'
import { resolveStageUiRange } from './competitionStages'
import type { CompetitionStageSettings } from './competitionStageSettings'
import type { ScheduleExecutionRecord, ScheduledBout } from './scheduleTypes'
import type { InternalBout } from './types'

export function buildCompetitionStageEligibility(input: {
  categoryKey: string
  categoryBouts: InternalBout[]
  allBouts: ScheduledBout[]
  executions: ScheduleExecutionRecord[]
  configuredCategoryStages: number[]
  stageSettings: CompetitionStageSettings
}): Record<number, boolean> {
  const { maxSelectable } = resolveStageUiRange({
    configuredCategoryStages: input.configuredCategoryStages,
    stageSettings: input.stageSettings,
  })
  const executionMap = new Map(input.executions.map((row) => [row.boutId, row]))
  const snapshot = { allBouts: input.allBouts, executions: executionMap }
  const result: Record<number, boolean> = {}

  for (let stage = 1; stage <= maxSelectable; stage += 1) {
    result[stage] = canChangeCompetitionStage({
      categoryBouts: input.categoryBouts,
      targetStage: stage,
      snapshot,
    })
  }

  return result
}

export function isCompetitionStageControlLocked(
  competitionStage: number,
  eligibility: Record<number, boolean> | undefined,
): boolean {
  if (!eligibility) return false
  return !Object.entries(eligibility).some(
    ([stage, allowed]) => Number(stage) !== competitionStage && allowed,
  )
}
