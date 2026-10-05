import { getOlympicRoundLabel } from '@/lib/brackets/layout/olympicGeometry'
import type { BoutSchedulePhase } from './types'

export type JudgeBoutHeaderInput = {
  categoryTitle?: string | null
  discipline?: string | null
  schedulePhase?: BoutSchedulePhase | null
  boutLabel?: string | null
  round?: number | null
  roundsUntilFinal?: number | null
  scheduleDisplayNumber?: string | null
}

export type JudgeBoutHeaderView = {
  matchTitle: string | null
  stageLabel: string | null
  categoryLine: string | null
}

export function formatJudgeBoutStageLabel(input: {
  schedulePhase?: BoutSchedulePhase | null
  boutLabel?: string | null
  round?: number | null
  roundsUntilFinal?: number | null
}): string | null {
  const label = input.boutLabel?.trim()
  if (label) return label

  const phase = input.schedulePhase
  if (phase === 'final') return 'Финал'
  if (phase === 'bronze') return 'Бой за 3-е место'
  if (phase === 'round_robin' && input.round != null) return `Тур ${input.round}`

  if (
    phase === 'elimination' &&
    input.round != null &&
    input.roundsUntilFinal != null &&
    input.roundsUntilFinal > 0
  ) {
    const maxRound = input.round + input.roundsUntilFinal
    const matchCount = 2 ** input.roundsUntilFinal
    return getOlympicRoundLabel(input.round, maxRound, matchCount)
  }

  if (input.round != null) return `Раунд ${input.round}`
  return null
}

export function formatJudgeBoutCategoryLine(
  categoryTitle?: string | null,
  discipline?: string | null,
): string | null {
  const title = categoryTitle?.trim()
  if (!title) return discipline?.trim() || null

  const disciplineLabel = discipline?.trim()
  if (!disciplineLabel) return title

  if (title === disciplineLabel) return title
  if (title.startsWith(`${disciplineLabel} · `) || title.startsWith(`${disciplineLabel}·`)) {
    return title
  }

  return title
}

export function isRedundantJudgeBoutStageLabel(
  stageLabel: string | null,
  scheduleDisplayNumber: string | null | undefined,
): boolean {
  if (!stageLabel || !scheduleDisplayNumber) return false
  const trimmed = stageLabel.trim()
  return (
    trimmed === `Бой ${scheduleDisplayNumber}` || trimmed === `Бой №${scheduleDisplayNumber}`
  )
}

export function formatJudgeBoutHeader(input: JudgeBoutHeaderInput): JudgeBoutHeaderView {
  const matchTitle = input.scheduleDisplayNumber
    ? `Бой №${input.scheduleDisplayNumber}`
    : null
  const stageLabel = formatJudgeBoutStageLabel(input)
  const categoryLine = formatJudgeBoutCategoryLine(input.categoryTitle, input.discipline)

  return { matchTitle, stageLabel, categoryLine }
}

export function shouldShowJudgeBoutStageLabel(
  stageLabel: string | null,
  scheduleDisplayNumber: string | null | undefined,
): boolean {
  if (!stageLabel) return false
  return !isRedundantJudgeBoutStageLabel(stageLabel, scheduleDisplayNumber)
}
