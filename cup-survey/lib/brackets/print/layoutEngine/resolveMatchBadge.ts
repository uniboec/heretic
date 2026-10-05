import type { BracketRoundMatch } from '../../core/types'
import { resolveBracketMatchBadgeLabel } from '../../scheduleBoutLabel'
import type { SlotResolveContext } from '../resolvePrintSlots'

export function resolvePrintMatchBadgeLabel(
  ctx: SlotResolveContext,
  match: BracketRoundMatch,
): string | null {
  if (!ctx.categoryKey) {
    return match.matchNumber != null ? `Бой №${match.matchNumber}` : null
  }

  return resolveBracketMatchBadgeLabel({
    categoryKey: ctx.categoryKey,
    matchId: match.id,
    label: match.label,
    matchNumber: match.matchNumber,
    scheduleDisplayByBoutId: ctx.scheduleDisplayByBoutId,
  })
}
