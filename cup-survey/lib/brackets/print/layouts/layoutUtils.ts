import type { BracketRoundMatch } from '../../core/types'
import { resolveBracketMatchBadgeLabel } from '../../scheduleBoutLabel'
import type { SlotResolveContext } from '../resolvePrintSlots'
import {
  resolveMatchSlot,
  resolveWinnerAdvance,
} from '../resolvePrintSlots'
import type { PrintMatchNode } from '../types'
import {
  PRINT_MATCH_GAP,
  PRINT_MATCH_ROW_HEIGHT,
  PRINT_MATCH_WIDTH,
} from '../printTheme'

export function matchNodeHeight(): number {
  return PRINT_MATCH_ROW_HEIGHT * 2 + PRINT_MATCH_GAP + PRINT_MATCH_BADGE()
}

function PRINT_MATCH_BADGE(): number {
  return 18
}

export function buildMatchNode(
  ctx: SlotResolveContext,
  match: BracketRoundMatch,
  position: { x: number; y: number },
  roundLabel?: string,
): PrintMatchNode {
  return {
    id: match.id,
    boutNumber: match.matchNumber ?? null,
    boutBadgeLabel: ctx.categoryKey
      ? resolveBracketMatchBadgeLabel({
          categoryKey: ctx.categoryKey,
          matchId: match.id,
          label: match.label,
          matchNumber: match.matchNumber,
          scheduleDisplayByBoutId: ctx.scheduleDisplayByBoutId,
        })
      : match.matchNumber != null
        ? `Бой №${match.matchNumber}`
        : null,
    roundLabel,
    slotA: resolveMatchSlot(ctx, match, 'A'),
    slotB: resolveMatchSlot(ctx, match, 'B'),
    advanceWinner: resolveWinnerAdvance(ctx, match),
    x: position.x,
    y: position.y,
    width: PRINT_MATCH_WIDTH,
    height: matchNodeHeight(),
  }
}

export function connectorRight(x: number, yTop: number, yBottom: number, yMid: number, xJunc: number): string[] {
  const xOut = x + PRINT_MATCH_WIDTH
  return [
    `M ${xOut} ${yTop + PRINT_MATCH_ROW_HEIGHT / 2} H ${xJunc}`,
    `M ${xOut} ${yBottom + PRINT_MATCH_ROW_HEIGHT / 2} H ${xJunc}`,
    `M ${xJunc} ${yTop + PRINT_MATCH_ROW_HEIGHT / 2} V ${yBottom + PRINT_MATCH_ROW_HEIGHT / 2}`,
    `M ${xJunc} ${(yTop + yBottom) / 2 + PRINT_MATCH_ROW_HEIGHT / 2} H ${xJunc + 40}`,
  ]
}

export function connectorSingle(x: number, y: number, xTarget: number): string {
  const yMid = y + PRINT_MATCH_ROW_HEIGHT
  return `M ${x + PRINT_MATCH_WIDTH} ${yMid} H ${xTarget}`
}
