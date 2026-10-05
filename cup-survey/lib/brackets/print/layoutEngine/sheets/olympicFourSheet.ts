import type { BracketExportCategory } from '../../../export/types'
import { effectiveBronzeMode } from '../../bronze/resolveOlympicBronzePrint'
import {
  buildSlotContext,
  resolveLoserAdvance,
  resolveMatchSlot,
  resolvePlacementSlot,
} from '../../resolvePrintSlots'
import {
  drawConnectorPath,
  drawHintLabel,
  drawMatchPair,
  drawPlacementOutcome,
  drawSectionLabel,
} from '../primitives'
import { resolvePrintMatchBadgeLabel } from '../resolveMatchBadge'
import { finalizeSvg, unionBounds } from '../metrics'

/** Landscape olympic bracket for four athletes with bronze repechage. */
export function renderOlympicFourSheet(category: BracketExportCategory): {
  svg: string
  width: number
  height: number
} {
  const ctx = buildSlotContext(category)
  const sf = category.structure.rounds.filter((m) => m.round === 1).sort((a, b) => a.slot - b.slot)
  const final = category.structure.rounds.find((m) => m.round === 2)
  const showBronze = effectiveBronzeMode(category) !== null

  const colSf = 16
  const row1Y = 32
  const nameWidth = 230

  const parts: string[] = []
  const rects: Array<{ x: number; y: number; width: number; height: number }> = []

  parts.push(drawSectionLabel(colSf, 12, 'ПОЛУФИНАЛЫ'))

  const sf1 = sf[0]
    ? drawMatchPair(
        colSf,
        row1Y,
        resolveMatchSlot(ctx, sf[0], 'A'),
        resolveMatchSlot(ctx, sf[0], 'B'),
        sf[0] ? resolvePrintMatchBadgeLabel(ctx, sf[0]) : null,
        nameWidth,
      )
    : null
  const sf2Y = row1Y + (sf1?.rect.height ?? 180) + 28
  const sf2 = sf[1]
    ? drawMatchPair(
        colSf,
        sf2Y,
        resolveMatchSlot(ctx, sf[1], 'A'),
        resolveMatchSlot(ctx, sf[1], 'B'),
        sf[1] ? resolvePrintMatchBadgeLabel(ctx, sf[1]) : null,
        nameWidth,
      )
    : null

  if (sf1) {
    parts.push(sf1.svg)
    rects.push(sf1.rect)
  }
  if (sf2) {
    parts.push(sf2.svg)
    rects.push(sf2.rect)
  }

  const matchRight =
    Math.max(sf1?.winnerAnchor.x ?? 0, sf2?.winnerAnchor.x ?? 0) + 28
  const colJunc = matchRight
  const colFinal = colJunc + 68
  const colPlaces = colFinal + 300

  parts.push(drawSectionLabel(colFinal, 12, 'ФИНАЛ'))
  parts.push(drawSectionLabel(colPlaces, 12, 'МЕСТА'))

  const finalY =
    sf1 && sf2
      ? sf1.topAthleteLeft.y - 8
      : row1Y

  let finalPair: ReturnType<typeof drawMatchPair> | null = null
  if (final) {
    finalPair = drawMatchPair(
      colFinal,
      finalY,
      resolveMatchSlot(ctx, final, 'A'),
      resolveMatchSlot(ctx, final, 'B'),
      resolvePrintMatchBadgeLabel(ctx, final),
      nameWidth,
    )
    parts.push(finalPair.svg)
    rects.push(finalPair.rect)
  }

  if (sf1 && sf2 && finalPair) {
    parts.push(
      drawConnectorPath(`M ${sf1.topAthleteAnchor.x} ${sf1.topAthleteAnchor.y} H ${colJunc}`),
      drawConnectorPath(`M ${sf2.bottomAthleteAnchor.x} ${sf2.bottomAthleteAnchor.y} H ${colJunc}`),
      drawConnectorPath(`M ${colJunc} ${sf1.topAthleteAnchor.y} V ${sf2.bottomAthleteAnchor.y}`),
      drawConnectorPath(`M ${colJunc} ${sf1.topAthleteAnchor.y} H ${finalPair.topAthleteLeft.x}`),
      drawConnectorPath(`M ${colJunc} ${sf2.bottomAthleteAnchor.y} H ${finalPair.bottomAthleteLeft.x}`),
    )
  }

  const p1 = drawPlacementOutcome(colPlaces, (finalPair?.topAthleteLeft.y ?? finalY) - 22, 1, resolvePlacementSlot(ctx, 1))
  const p2 = drawPlacementOutcome(
    colPlaces,
    (finalPair?.bottomAthleteLeft.y ?? finalY + 56) - 22,
    2,
    resolvePlacementSlot(ctx, 2),
  )
  parts.push(p1.svg, p2.svg)
  rects.push(p1.rect, p2.rect)

  if (finalPair) {
    const trunkX = colPlaces - 36
    parts.push(
      drawConnectorPath(`M ${finalPair.topAthleteAnchor.x} ${finalPair.topAthleteAnchor.y} H ${trunkX}`),
      drawConnectorPath(`M ${trunkX} ${finalPair.topAthleteAnchor.y} V ${p1.lineStart.y}`),
      drawConnectorPath(`M ${trunkX} ${p1.lineStart.y} H ${p1.lineStart.x}`),
      drawConnectorPath(`M ${finalPair.bottomAthleteAnchor.x} ${finalPair.bottomAthleteAnchor.y} H ${trunkX}`),
      drawConnectorPath(`M ${trunkX} ${finalPair.bottomAthleteAnchor.y} V ${p2.lineStart.y}`),
      drawConnectorPath(`M ${trunkX} ${p2.lineStart.y} H ${p2.lineStart.x}`),
    )
  }

  if (showBronze && sf[0] && sf[1]) {
    const bronzeY = sf2Y + (sf2?.rect.height ?? 180) + 36
    parts.push(drawSectionLabel(colSf, bronzeY, 'БРОНЗА'))

    const l1 = resolveLoserAdvance(ctx, sf[0])
    const l2 = resolveLoserAdvance(ctx, sf[1])
    const bronzeMatch = drawMatchPair(colSf, bronzeY + 18, l1, l2, null, nameWidth)
    parts.push(
      drawHintLabel(colSf, bronzeY + 28, 'Проигравший ПФ1 / Проигравший ПФ2'),
      bronzeMatch.svg,
    )
    rects.push(bronzeMatch.rect)

    const p3 = drawPlacementOutcome(colPlaces, bronzeMatch.winnerAnchor.y - 22, 3, resolvePlacementSlot(ctx, 3))
    parts.push(p3.svg)
    rects.push(p3.rect)

    const bronzeDropX = colJunc + 16
    parts.push(
      drawConnectorPath(`M ${sf1!.bottomAthleteAnchor.x} ${sf1!.bottomAthleteAnchor.y} H ${bronzeDropX}`),
      drawConnectorPath(`M ${bronzeDropX} ${sf1!.bottomAthleteAnchor.y} V ${bronzeMatch.topAthleteLeft.y}`),
      drawConnectorPath(`M ${bronzeDropX} ${bronzeMatch.topAthleteLeft.y} H ${bronzeMatch.topAthleteLeft.x}`),
      drawConnectorPath(`M ${sf2!.topAthleteAnchor.x} ${sf2!.topAthleteAnchor.y} H ${bronzeDropX + 28}`),
      drawConnectorPath(`M ${bronzeDropX + 28} ${sf2!.topAthleteAnchor.y} V ${bronzeMatch.bottomAthleteLeft.y}`),
      drawConnectorPath(`M ${bronzeDropX + 28} ${bronzeMatch.bottomAthleteLeft.y} H ${bronzeMatch.bottomAthleteLeft.x}`),
      drawConnectorPath(`M ${bronzeMatch.winnerAnchor.x} ${bronzeMatch.winnerAnchor.y} H ${colPlaces - 36}`),
      drawConnectorPath(`M ${colPlaces - 36} ${bronzeMatch.winnerAnchor.y} V ${p3.lineStart.y}`),
      drawConnectorPath(`M ${colPlaces - 36} ${p3.lineStart.y} H ${p3.lineStart.x}`),
    )
  }

  return finalizeSvg(parts, unionBounds(rects.length ? rects : [{ x: 0, y: 0, width: 900, height: 400 }]))
}
