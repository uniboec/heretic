import type { BracketRoundMatch, BracketSlotSource } from '../core/types'
import { formatScheduleAdvanceHint } from '../scheduleHint'

export function formatAdvanceHintFromSource(
  rounds: BracketRoundMatch[],
  source: BracketSlotSource,
  options?: {
    categoryKey?: string
    released?: boolean
    scheduleDisplayByBoutId?: Map<string, string>
    fallbackHint?: string
  },
): string | undefined {
  const feeder = rounds.find((match) => match.id === source.matchId)
  if (!feeder) return options?.fallbackHint

  if (options?.categoryKey) {
    return formatScheduleAdvanceHint({
      categoryKey: options.categoryKey,
      feederMatchId: source.matchId,
      outcome: source.outcome,
      released: options.released === true,
      scheduleDisplayByBoutId: options.scheduleDisplayByBoutId,
      fallbackHint: options.fallbackHint ?? feeder.slotHintA ?? feeder.slotHintB,
    })
  }

  return options?.fallbackHint
}

export function formatAdvanceHintFromMatch(
  match: BracketRoundMatch,
  outcome: 'WINNER' | 'LOSER',
  options?: {
    categoryKey?: string
    released?: boolean
    scheduleDisplayByBoutId?: Map<string, string>
  },
): string | undefined {
  if (options?.categoryKey) {
    return formatScheduleAdvanceHint({
      categoryKey: options.categoryKey,
      feederMatchId: match.id,
      outcome: outcome === 'WINNER' ? 'winner' : 'loser',
      released: options.released === true,
      scheduleDisplayByBoutId: options.scheduleDisplayByBoutId,
      fallbackHint: match.label,
    })
  }
  return match.label
}
