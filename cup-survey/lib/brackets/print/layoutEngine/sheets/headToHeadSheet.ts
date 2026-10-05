import type { BracketExportCategory } from '../../../export/types'
import {
  buildSlotContext,
  resolveMatchSlot,
  resolvePlacementSlot,
} from '../../resolvePrintSlots'
import {
  drawConnectorPath,
  drawMatchPair,
  drawPlacementOutcome,
  drawSectionLabel,
} from '../primitives'
import { resolvePrintMatchBadgeLabel } from '../resolveMatchBadge'
import { finalizeSvg, unionBounds } from '../metrics'

/** Portrait final for two athletes — match block, fork, 1st/2nd below. */
export function renderHeadToHeadSheet(category: BracketExportCategory): {
  svg: string
  width: number
  height: number
} {
  const ctx = buildSlotContext(category)
  const match = category.structure.rounds[0]
  if (!match) {
    return finalizeSvg([], { x: 0, y: 0, width: 400, height: 200 })
  }

  const slotA = resolveMatchSlot(ctx, match, 'A')
  const slotB = resolveMatchSlot(ctx, match, 'B')
  const placement1 = resolvePlacementSlot(ctx, 1)
  const placement2 = resolvePlacementSlot(ctx, 2)

  const x = 72
  const y = 64
  const nameWidth = 420
  const badgeLabel = resolvePrintMatchBadgeLabel(ctx, match)
  const pair = drawMatchPair(x, y, slotA, slotB, badgeLabel, nameWidth)

  const title = drawSectionLabel(x, 28, `ФИНАЛ · ${badgeLabel ?? 'Бой'}`)

  const forkY = y + pair.rect.height + 88
  const centerX = x + pair.rect.width / 2
  const railX = x + 48

  const first = drawPlacementOutcome(x, forkY + 48, 1, placement1)
  const second = drawPlacementOutcome(x, forkY + 128, 2, placement2)

  const connectors = [
    drawConnectorPath(`M ${centerX} ${pair.rect.y + pair.rect.height} V ${forkY}`),
    drawConnectorPath(`M ${railX} ${forkY} H ${centerX + 40}`),
    drawConnectorPath(`M ${railX} ${forkY} V ${first.lineStart.y}`),
    drawConnectorPath(`M ${railX} ${first.lineStart.y} H ${first.lineStart.x}`),
    drawConnectorPath(`M ${centerX + 40} ${forkY} V ${second.lineStart.y}`),
    drawConnectorPath(`M ${centerX + 40} ${second.lineStart.y} H ${second.lineStart.x}`),
  ]

  const parts = [title, pair.svg, ...connectors, first.svg, second.svg]
  const bounds = unionBounds([
    pair.rect,
    first.rect,
    second.rect,
    { x, y: 16, width: nameWidth + 80, height: 24 },
    { x, y: forkY, width: nameWidth + 80, height: 180 },
  ])

  return finalizeSvg(parts, bounds)
}
