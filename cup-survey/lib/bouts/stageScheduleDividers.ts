import { TOURNAMENT_TIMEZONE } from '../config/tournament'
import { collectScheduledUsedStages } from './competitionStages'
import { formatBoutTime } from './startTimes'
import type { StageTimingSummary } from './scheduleTypes'

export type StageDividerPresentation = {
  stage: number
  title: string
  details: string[]
}

export function shouldShowStageDividers(bouts: { competitionStage: number }[]): boolean {
  const usedStages = collectScheduledUsedStages(bouts)
  return usedStages.length > 1 || (usedStages.length === 1 && usedStages[0] !== 1)
}

export function formatStageDividerPresentation(
  stage: number,
  summary?: StageTimingSummary,
): StageDividerPresentation {
  const details: string[] = []
  if (summary?.notBeforeStartAt) {
    details.push(`Старт не ранее: ${formatBoutTime(summary.notBeforeStartAt, TOURNAMENT_TIMEZONE)}`)
  }
  if (summary?.estimatedStartAt) {
    details.push(
      `Ожидаемый старт: ${formatBoutTime(summary.estimatedStartAt, TOURNAMENT_TIMEZONE)}`,
    )
  }
  if (summary?.isDelayed && summary.delayMinutes > 0) {
    const planned = summary.plannedStartAt
      ? formatBoutTime(summary.plannedStartAt, TOURNAMENT_TIMEZONE)
      : null
    details.push(
      planned
        ? `Задержка: +${summary.delayMinutes} мин (по плану ${planned})`
        : `Задержка: +${summary.delayMinutes} мин`,
    )
  }
  return {
    stage,
    title: `Этап ${stage}`,
    details,
  }
}

export type ScheduleRowWithStage<T> =
  | { kind: 'stage-divider'; presentation: StageDividerPresentation }
  | { kind: 'bout'; bout: T }

export function buildScheduleRowsWithStageDividers<T extends { competitionStage: number }>(
  bouts: T[],
  stageSummaries: StageTimingSummary[],
): ScheduleRowWithStage<T>[] {
  if (!shouldShowStageDividers(bouts)) {
    return bouts.map((bout) => ({ kind: 'bout', bout }))
  }

  const summaryByStage = new Map(stageSummaries.map((summary) => [summary.stage, summary]))
  const rows: ScheduleRowWithStage<T>[] = []
  let lastStage: number | null = null

  for (const bout of bouts) {
    if (lastStage !== null && bout.competitionStage !== lastStage) {
      rows.push({
        kind: 'stage-divider',
        presentation: formatStageDividerPresentation(
          bout.competitionStage,
          summaryByStage.get(bout.competitionStage),
        ),
      })
    }
    rows.push({ kind: 'bout', bout })
    lastStage = bout.competitionStage
  }

  return rows
}

export function formatStageSummariesHeader(summaries: StageTimingSummary[]): string | null {
  if (summaries.length === 0) return null
  if (summaries.length === 1 && summaries[0]?.stage === 1) return null

  const parts = summaries.map((summary) => {
    const start = formatBoutTime(summary.estimatedStartAt, TOURNAMENT_TIMEZONE)
    const lastBoutEnd = summary.estimatedStartAt
    const approx = summary.isDelayed ? '≈' : ''
    return `Этап ${summary.stage}: ${approx}${start}`
  })
  return parts.join(' · ')
}
