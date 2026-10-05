import { formatBoutLoserHint, formatBoutWinnerHint } from './labels'

export const NEUTRAL_ADVANCE_HINT = 'Победитель предыдущего поединка'
export const NEUTRAL_LOSER_ADVANCE_HINT = 'Проигравший предыдущего поединка'

const INTERNAL_WINNER_HINT = /^Победитель боя (\d+)$/
const INTERNAL_LOSER_HINT = /^Проигравший боя (\d+)$/
export function parseInternalAdvanceHintLabel(
  label: string,
): { feederMatchId: string; outcome: 'winner' | 'loser' } | null {
  const winner = INTERNAL_WINNER_HINT.exec(label.trim())
  if (winner) {
    return { feederMatchId: `bout-${winner[1]}`, outcome: 'winner' }
  }

  const loser = INTERNAL_LOSER_HINT.exec(label.trim())
  if (loser) {
    return { feederMatchId: `bout-${loser[1]}`, outcome: 'loser' }
  }

  return null
}

export function resolveStaleAdvanceHintLabel(input: {
  label?: string
  categoryKey: string
  released: boolean
  scheduleDisplayByBoutId?: Map<string, string>
}): string | undefined {
  if (!input.label) return undefined

  const parsed = parseInternalAdvanceHintLabel(input.label)
  if (!parsed) return input.label

  return formatScheduleAdvanceHint({
    categoryKey: input.categoryKey,
    feederMatchId: parsed.feederMatchId,
    outcome: parsed.outcome,
    released: input.released,
    scheduleDisplayByBoutId: input.scheduleDisplayByBoutId,
    fallbackHint: input.label,
  })
}

export function resolveBronzeFightTitle(input: {
  matchId: string
  label: string
  categoryKey: string
  scheduleDisplayByBoutId?: Map<string, string>
}): string {
  const displayNumber = input.scheduleDisplayByBoutId?.get(
    resolveBoutIdForBracketMatch(input.categoryKey, input.matchId),
  )
  if (displayNumber) {
    return `Бой за 3-е место (${displayNumber})`
  }

  return input.label
}

export function resolveBoutIdForBracketMatch(categoryKey: string, matchId: string): string {
  return `${categoryKey}::${matchId}`
}

export function formatScheduleAdvanceHint(input: {
  categoryKey: string
  feederMatchId: string
  outcome: 'winner' | 'loser'
  released: boolean
  scheduleDisplayByBoutId?: Map<string, string>
  fallbackHint?: string
}): string | undefined {
  const boutId = resolveBoutIdForBracketMatch(input.categoryKey, input.feederMatchId)
  const displayNumber = input.scheduleDisplayByBoutId?.get(boutId)
  if (displayNumber) {
    return input.outcome === 'winner'
      ? formatBoutWinnerHint(displayNumber)
      : formatBoutLoserHint(displayNumber)
  }

  if (!input.released) {
    return input.outcome === 'winner' ? NEUTRAL_ADVANCE_HINT : NEUTRAL_LOSER_ADVANCE_HINT
  }

  return input.fallbackHint
}
