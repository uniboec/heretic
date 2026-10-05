import type { ScheduleExecutionRecord, ScheduledBout } from './scheduleTypes'
import { collectScheduledUsedStages } from './competitionStages'
import type { InternalBout } from './types'

export type ScheduleExecutionSnapshot = {
  allBouts: ScheduledBout[]
  executions: Map<string, ScheduleExecutionRecord>
}

export function hasStageFactuallyStarted(
  stage: number,
  snapshot: ScheduleExecutionSnapshot,
): boolean {
  return snapshot.allBouts
    .filter((b) => b.competitionStage === stage)
    .some((b) => {
      const execution = snapshot.executions.get(b.id)
      return execution?.actualStartAt != null
    })
}

export function canChangeCompetitionStage(input: {
  categoryBouts: InternalBout[]
  targetStage: number
  snapshot: ScheduleExecutionSnapshot
}): boolean {
  const allUpcoming = input.categoryBouts.every(
    (b) => !input.snapshot.executions.get(b.id)?.actualStartAt,
  )
  if (!allUpcoming) return false

  const usedStages = collectScheduledUsedStages(input.snapshot.allBouts)
  const targetAlreadyStarted = usedStages
    .filter((s) => s >= input.targetStage)
    .some((s) => hasStageFactuallyStarted(s, input.snapshot))

  return !targetAlreadyStarted
}
