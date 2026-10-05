import { TOURNAMENT_TIMEZONE } from '../config/tournament'
import {
  isValidNotBeforeLocalTime,
  resolveStageNotBefore,
  type CompetitionStageSettings,
} from './competitionStageSettings'
import { previousUsedStage } from './competitionStages'
import type { StageTimingSummary } from './scheduleTypes'

export type StageSettingsWarning = {
  stage: number
  kind: 'not_before_before_prev_stage_end' | 'not_before_before_previous_not_before'
  message: string
}

function usedStagesFromSummaries(summaries: StageTimingSummary[]): number[] {
  return [...summaries].map((summary) => summary.stage).sort((a, b) => a - b)
}

function resolveDraftNotBefore(
  stage: number,
  draftNotBefore: Record<string, string> | undefined,
  settings: CompetitionStageSettings,
): string | undefined {
  const raw = draftNotBefore?.[String(stage)]
  if (raw !== undefined) {
    const trimmed = raw.trim()
    if (!trimmed) return undefined
    return isValidNotBeforeLocalTime(trimmed) ? trimmed : undefined
  }
  const saved = settings.notBeforeStartTimes[String(stage)]
  return saved && isValidNotBeforeLocalTime(saved) ? saved : undefined
}

export function buildStageSettingsWarnings(input: {
  stageSettings: CompetitionStageSettings
  stageSummaries: StageTimingSummary[]
  eventDate: string
  draftNotBefore?: Record<string, string>
}): StageSettingsWarning[] {
  const warnings: StageSettingsWarning[] = []
  const usedStages = usedStagesFromSummaries(input.stageSummaries)
  const summariesByStage = new Map(input.stageSummaries.map((summary) => [summary.stage, summary]))

  for (const stage of usedStages) {
    if (stage < 2) continue
    const notBeforeTime = resolveDraftNotBefore(stage, input.draftNotBefore, input.stageSettings)
    if (!notBeforeTime) continue

    const stageSummary = summariesByStage.get(stage)
    if (!stageSummary) continue

    const notBeforeInstant = resolveStageNotBefore(
      stage,
      {
        ...input.stageSettings,
        notBeforeStartTimes: {
          ...input.stageSettings.notBeforeStartTimes,
          [String(stage)]: notBeforeTime,
        },
      },
      input.eventDate,
      TOURNAMENT_TIMEZONE,
    )
    const plannedStart = new Date(stageSummary.plannedStartAt)
    if (notBeforeInstant.getTime() < plannedStart.getTime()) {
      warnings.push({
        stage,
        kind: 'not_before_before_prev_stage_end',
        message:
          'Фактический старт будет позже: этап ещё не завершён или не прошла пауза после предыдущего этапа.',
      })
    }
  }

  const configuredStages = [...usedStages]
    .filter((stage) => stage >= 2)
    .filter((stage) => resolveDraftNotBefore(stage, input.draftNotBefore, input.stageSettings))
  configuredStages.sort((a, b) => a - b)

  for (let index = 1; index < configuredStages.length; index += 1) {
    const stage = configuredStages[index]!
    const prevStage = configuredStages[index - 1]!
    const currentTime = resolveDraftNotBefore(stage, input.draftNotBefore, input.stageSettings)!
    const prevTime = resolveDraftNotBefore(prevStage, input.draftNotBefore, input.stageSettings)!
    if (currentTime < prevTime) {
      warnings.push({
        stage,
        kind: 'not_before_before_previous_not_before',
        message: `«Старт не ранее» этапа ${stage} раньше, чем у этапа ${prevStage} — фактический порядок может отличаться.`,
      })
    }
  }

  for (const stage of usedStages) {
    if (stage < 3) continue
    const prevUsed = previousUsedStage(stage, usedStages)
    if (prevUsed == null || prevUsed === stage - 1) continue
    const notBeforeTime = resolveDraftNotBefore(stage, input.draftNotBefore, input.stageSettings)
    const prevNotBefore = resolveDraftNotBefore(prevUsed, input.draftNotBefore, input.stageSettings)
    if (notBeforeTime && prevNotBefore && notBeforeTime < prevNotBefore) {
      const alreadyWarned = warnings.some(
        (warning) =>
          warning.stage === stage &&
          warning.kind === 'not_before_before_previous_not_before',
      )
      if (!alreadyWarned) {
        warnings.push({
          stage,
          kind: 'not_before_before_previous_not_before',
          message: `«Старт не ранее» этапа ${stage} раньше, чем у этапа ${prevUsed}.`,
        })
      }
    }
  }

  return warnings
}
