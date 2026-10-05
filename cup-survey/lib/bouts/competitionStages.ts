import type { CompetitionStageSettings } from './competitionStageSettings'

export const MAX_COMPETITION_STAGE = 50

export function assertCompetitionStageInRange(stage: number): void {
  if (!Number.isInteger(stage) || stage < 1 || stage > MAX_COMPETITION_STAGE) {
    throw new Error(`competitionStage must be an integer from 1 to ${MAX_COMPETITION_STAGE}`)
  }
}

export function collectScheduledUsedStages(
  bouts: { competitionStage: number }[],
): number[] {
  return [...new Set(bouts.map((b) => b.competitionStage))].sort((a, b) => a - b)
}

export function collectConfiguredCategoryStages(
  draws: { competitionStage: number }[],
): number[] {
  return [...new Set(draws.map((d) => d.competitionStage))].sort((a, b) => a - b)
}

export function previousUsedStage(stage: number, usedStages: number[]): number | null {
  const index = usedStages.indexOf(stage)
  if (index <= 0) return null
  return usedStages[index - 1]!
}

export function nextUsedStage(stage: number, usedStages: number[]): number | null {
  const index = usedStages.indexOf(stage)
  if (index < 0 || index >= usedStages.length - 1) return null
  return usedStages[index + 1]!
}

export function maxConfiguredStage(settings: CompetitionStageSettings): number {
  const keys = [
    ...Object.keys(settings.breaksAfterStageMinutes),
    ...Object.keys(settings.notBeforeStartTimes),
  ].map(Number)
  return keys.length ? Math.max(...keys) : 0
}

export function resolveStageUiRange(input: {
  configuredCategoryStages: number[]
  stageSettings: CompetitionStageSettings
}): { min: 1; maxDisplay: number; maxSelectable: number } {
  const maxUsed = input.configuredCategoryStages.length
    ? Math.max(...input.configuredCategoryStages)
    : 1
  const maxConfiguredSettings = maxConfiguredStage(input.stageSettings)
  const maxBase = Math.max(maxUsed, maxConfiguredSettings)
  return {
    min: 1,
    maxDisplay: Math.min(MAX_COMPETITION_STAGE, maxBase),
    maxSelectable: Math.min(
      MAX_COMPETITION_STAGE,
      Math.max(maxUsed + 1, maxConfiguredSettings),
    ),
  }
}

export function stageGapMinutes(
  prevStage: number,
  stageSettings: CompetitionStageSettings,
  boutBreakMinutes: number,
): number {
  const stageBreak = stageSettings.breaksAfterStageMinutes[String(prevStage)] ?? 0
  return Math.max(boutBreakMinutes, stageBreak)
}
