'use client'

import type { ReactNode } from 'react'
import { judgeStyles } from '../judgeModeStyles'

export type JudgeGridVariant = 'scoring' | 'decision'

export function JudgeWorkGrid({
  variant = 'scoring',
  red,
  center,
  blue,
}: {
  variant?: JudgeGridVariant
  red: ReactNode
  center: ReactNode
  blue: ReactNode
}) {
  const gridClass = variant === 'decision' ? judgeStyles.grid3Decision : judgeStyles.grid3Scoring

  return (
    <div className={gridClass}>
      <div className="min-w-0">{red}</div>
      <div className="min-w-0">{center}</div>
      <div className="min-w-0">{blue}</div>
    </div>
  )
}
