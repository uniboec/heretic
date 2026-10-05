import type { BracketExportCategory } from '../../../export/types'
import {
  buildSlotContext,
  resolveLoserAdvance,
  resolveMatchSlot,
  resolvePlacementSlot,
} from '../../resolvePrintSlots'
import {
  drawBoutBadge,
  drawConnectorPath,
  drawHintLabel,
  drawMatchPair,
  drawPlacementOutcome,
  drawSectionLabel,
} from '../primitives'
import { resolvePrintMatchBadgeLabel } from '../resolveMatchBadge'
import { finalizeSvg, unionBounds } from '../metrics'

/** Portrait three-way comeback — vertical bout stack with routes on the right. */
export function renderThreeWaySheet(category: BracketExportCategory): {
  svg: string
  width: number
  height: number
} {
  const ctx = buildSlotContext(category)
  const bout1 = category.structure.rounds.find((m) => m.round === 1)
  const bout2 = category.structure.rounds.find((m) => m.round === 2)
  const final = category.structure.rounds.find((m) => m.round === 3)

  const matchX = 56
  const placeX = 430
  const nameWidth = 250
  const gap = 56

  const parts: string[] = []
  const rects: Array<{ x: number; y: number; width: number; height: number }> = []

  let y = 52
  parts.push(drawSectionLabel(matchX, 24, 'ТРОЙКА С ВОЗВРАТОМ'))

  let bout1Pair: ReturnType<typeof drawMatchPair> | null = null
  let bout2Pair: ReturnType<typeof drawMatchPair> | null = null
  let finalPair: ReturnType<typeof drawMatchPair> | null = null

  if (bout1) {
    const bout1Badge = resolvePrintMatchBadgeLabel(ctx, bout1)
    parts.push(drawSectionLabel(matchX, y, bout1Badge?.toUpperCase() ?? 'БОЙ'))
    y += 18
    bout1Pair = drawMatchPair(
      matchX,
      y,
      resolveMatchSlot(ctx, bout1, 'A'),
      resolveMatchSlot(ctx, bout1, 'B'),
      bout1Badge,
      nameWidth,
    )
    parts.push(bout1Pair.svg)
    rects.push(bout1Pair.rect)
    y += bout1Pair.rect.height + gap
  }

  if (bout2 && bout1) {
    const bout2Badge = resolvePrintMatchBadgeLabel(ctx, bout2)
    parts.push(drawSectionLabel(matchX, y, bout2Badge?.toUpperCase() ?? 'БОЙ'))
    y += 18
    const slotA = resolveLoserAdvance(ctx, bout1)
    const slotB = resolveMatchSlot(ctx, bout2, 'B')
    bout2Pair = drawMatchPair(matchX, y, slotA, slotB, bout2Badge, nameWidth)
    parts.push(bout2Pair.svg)
    rects.push(bout2Pair.rect)
    y += bout2Pair.rect.height + gap
  }

  if (final) {
    parts.push(drawSectionLabel(matchX, y, 'ФИНАЛ'))
    y += 18
    finalPair = drawMatchPair(
      matchX,
      y,
      resolveMatchSlot(ctx, final, 'A'),
      resolveMatchSlot(ctx, final, 'B'),
      null,
      nameWidth,
    )
    const finalBadge = resolvePrintMatchBadgeLabel(ctx, final)
    const badge = drawBoutBadge(
      finalPair.badgeCenter.x,
      finalPair.rect.y - 26,
      finalBadge ?? 'Бой',
    )
    parts.push(badge.svg, finalPair.svg)
    rects.push(finalPair.rect, badge.rect)
  }

  const routeX =
    Math.max(
      bout1Pair?.winnerAnchor.x ?? 0,
      bout2Pair?.winnerAnchor.x ?? 0,
      finalPair?.winnerAnchor.x ?? 0,
    ) + 24

  if (bout1Pair && bout2Pair && finalPair) {
    parts.push(
      drawHintLabel(routeX + 4, bout1Pair.topAthleteAnchor.y - 14, 'W1 → финал'),
      drawHintLabel(routeX + 4, bout1Pair.bottomAthleteAnchor.y - 14, 'L1 → бой 2'),
      drawHintLabel(routeX + 4, bout2Pair.bottomAthleteAnchor.y - 14, 'W2 → финал'),
      drawHintLabel(routeX + 4, bout2Pair.topAthleteAnchor.y - 14, 'L2 → 3 место'),
      drawConnectorPath(`M ${bout1Pair.topAthleteAnchor.x} ${bout1Pair.topAthleteAnchor.y} H ${routeX}`),
      drawConnectorPath(`M ${routeX} ${bout1Pair.topAthleteAnchor.y} V ${finalPair.topAthleteLeft.y}`),
      drawConnectorPath(`M ${routeX} ${finalPair.topAthleteLeft.y} H ${finalPair.topAthleteLeft.x}`),
      drawConnectorPath(`M ${bout1Pair.bottomAthleteAnchor.x} ${bout1Pair.bottomAthleteAnchor.y} H ${routeX}`),
      drawConnectorPath(`M ${routeX} ${bout1Pair.bottomAthleteAnchor.y} V ${bout2Pair.topAthleteLeft.y}`),
      drawConnectorPath(`M ${routeX} ${bout2Pair.topAthleteLeft.y} H ${bout2Pair.topAthleteLeft.x}`),
      drawConnectorPath(`M ${bout2Pair.bottomAthleteAnchor.x} ${bout2Pair.bottomAthleteAnchor.y} H ${routeX}`),
      drawConnectorPath(`M ${routeX} ${bout2Pair.bottomAthleteAnchor.y} V ${finalPair.bottomAthleteLeft.y}`),
      drawConnectorPath(`M ${routeX} ${finalPair.bottomAthleteLeft.y} H ${finalPair.bottomAthleteLeft.x}`),
    )
  }

  parts.push(drawSectionLabel(placeX, 52, 'МЕСТА'))

  const p1Y = (finalPair?.topAthleteLeft.y ?? y) - 22
  const p2Y = (finalPair?.bottomAthleteLeft.y ?? y + 56) - 22
  const p3Y = Math.max(p2Y + 56, (bout2Pair?.bottomAthleteLeft.y ?? y) + 24)

  const p1 = drawPlacementOutcome(placeX, p1Y, 1, resolvePlacementSlot(ctx, 1))
  const p2 = drawPlacementOutcome(placeX, p2Y, 2, resolvePlacementSlot(ctx, 2))
  const p3Slot = bout2 ? resolveLoserAdvance(ctx, bout2) : resolvePlacementSlot(ctx, 3)
  const p3 = drawPlacementOutcome(placeX, p3Y, 3, p3Slot)

  parts.push(p1.svg, p2.svg, p3.svg)
  rects.push(p1.rect, p2.rect, p3.rect)

  if (finalPair) {
    const trunkX = placeX - 28
    parts.push(
      drawConnectorPath(`M ${finalPair.topAthleteAnchor.x} ${finalPair.topAthleteAnchor.y} H ${trunkX}`),
      drawConnectorPath(`M ${trunkX} ${finalPair.topAthleteAnchor.y} V ${p1.lineStart.y}`),
      drawConnectorPath(`M ${trunkX} ${p1.lineStart.y} H ${p1.lineStart.x}`),
      drawConnectorPath(`M ${finalPair.bottomAthleteAnchor.x} ${finalPair.bottomAthleteAnchor.y} H ${trunkX}`),
      drawConnectorPath(`M ${trunkX} ${finalPair.bottomAthleteAnchor.y} V ${p2.lineStart.y}`),
      drawConnectorPath(`M ${trunkX} ${p2.lineStart.y} H ${p2.lineStart.x}`),
    )
  }

  if (bout2Pair) {
    parts.push(
      drawConnectorPath(`M ${bout2Pair.topAthleteAnchor.x} ${bout2Pair.topAthleteAnchor.y} H ${placeX - 28}`),
      drawConnectorPath(`M ${placeX - 28} ${bout2Pair.topAthleteAnchor.y} V ${p3.lineStart.y}`),
      drawConnectorPath(`M ${placeX - 28} ${p3.lineStart.y} H ${p3.lineStart.x}`),
    )
  }

  const bounds = unionBounds(rects.length ? rects : [{ x: 0, y: 0, width: 760, height: 520 }])
  bounds.height = Math.max(bounds.height, p3.rect.y + p3.rect.height + 40)

  return finalizeSvg(parts, bounds)
}
