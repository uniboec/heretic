import {
  collectScheduledUsedStages,
  nextUsedStage,
} from './competitionStages'
import {
  diffStageSettings,
  normalizeCompetitionStageSettings,
  type CompetitionStageSettings,
} from './competitionStageSettings'
import { StageSettingsLockedError } from './errors'
import type { ScheduleExecutionRecord, ScheduledBout } from './scheduleTypes'
import { hasStageFactuallyStarted } from './competitionStageLifecycle'

export function assertStageSettingsPatchAllowed(input: {
  oldSettings: CompetitionStageSettings
  newSettings: CompetitionStageSettings
  allBouts: ScheduledBout[]
  executions: ScheduleExecutionRecord[]
  boutsStartTimeChanged: boolean
  boutBreakMinutesChanged: boolean
}): void {
  const snapshot = {
    allBouts: input.allBouts,
    executions: new Map(input.executions.map((e) => [e.boutId, e])),
  }
  const usedStages = collectScheduledUsedStages(input.allBouts)
  const diff = diffStageSettings(input.oldSettings, input.newSettings)

  for (const change of diff.notBeforeChanges) {
    if (hasStageFactuallyStarted(change.stage, snapshot)) {
      throw new StageSettingsLockedError()
    }
  }

  for (const change of diff.breakAfterChanges) {
    const next = nextUsedStage(change.stage, usedStages)
    if (next != null && hasStageFactuallyStarted(next, snapshot)) {
      throw new StageSettingsLockedError()
    }
  }

  const firstUsedStage = usedStages[0]
  if (
    input.boutsStartTimeChanged &&
    firstUsedStage != null &&
    hasStageFactuallyStarted(firstUsedStage, snapshot)
  ) {
    throw new StageSettingsLockedError()
  }

  const secondUsedStage = usedStages[1]
  if (
    input.boutBreakMinutesChanged &&
    secondUsedStage != null &&
    hasStageFactuallyStarted(secondUsedStage, snapshot)
  ) {
    throw new StageSettingsLockedError()
  }
}

export function normalizeStageSettingsPatch(
  raw: unknown,
): CompetitionStageSettings | undefined {
  if (raw === undefined) return undefined
  return normalizeCompetitionStageSettings(raw)
}
