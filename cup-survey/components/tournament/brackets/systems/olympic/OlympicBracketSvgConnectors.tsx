'use client'

import { useMemo } from 'react'
import {
  buildOlympicConnectorPaths,
  getOlympicBracketViewBox,
  getSlotHeightPx,
  type OlympicLayoutOptions,
} from './olympicBracketGeometry'

interface OlympicBracketSvgConnectorsProps {
  maxRound: number
  firstRoundMatchCount: number
  isCompact?: boolean
  layoutOptions?: OlympicLayoutOptions
}

export function OlympicBracketSvgConnectors({
  maxRound,
  firstRoundMatchCount,
  isCompact = false,
  layoutOptions,
}: OlympicBracketSvgConnectorsProps) {
  const slotHeightPx = getSlotHeightPx(firstRoundMatchCount, isCompact, layoutOptions)

  const { paths, viewBox } = useMemo(() => {
    const box = getOlympicBracketViewBox(
      maxRound,
      firstRoundMatchCount,
      slotHeightPx,
      isCompact,
      layoutOptions,
    )
    return {
      viewBox: box,
      paths: buildOlympicConnectorPaths(
        maxRound,
        firstRoundMatchCount,
        slotHeightPx,
        isCompact,
        layoutOptions,
      ),
    }
  }, [maxRound, firstRoundMatchCount, slotHeightPx, isCompact, layoutOptions])

  if (maxRound < 2) return null

  return (
    <svg
      className="bracket-tree__svg-connectors"
      width={viewBox.width}
      height={viewBox.height}
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {paths.map((d, index) => (
        <path key={index} d={d} className="bracket-tree__svg-path" />
      ))}
    </svg>
  )
}
