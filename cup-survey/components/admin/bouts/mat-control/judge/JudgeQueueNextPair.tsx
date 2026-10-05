'use client'

import type { InternalBout } from '@/lib/bouts/types'
import type { MandateWarning } from '@/lib/mandate/types'

import { JudgeQueueAthleteLine } from './JudgeQueueAthleteLine'
import { warningsForAthleteSide } from './judgeQueueFormat'

export function JudgeQueueNextPair({
  bout,
  compact = false,
  entryWarnings = {},
}: {
  bout: InternalBout
  compact?: boolean
  entryWarnings?: Record<string, MandateWarning[]>
}) {
  const sideAWarnings = warningsForAthleteSide(bout.sideA, entryWarnings)
  const sideBWarnings = warningsForAthleteSide(bout.sideB, entryWarnings)

  if (compact) {
    return (
      <span className="flex shrink-0 items-center gap-1.5">
        <JudgeQueueAthleteLine side={bout.sideA} compact warnings={sideAWarnings} />
        <span className="shrink-0 text-[11px] text-muted">—</span>
        <JudgeQueueAthleteLine side={bout.sideB} compact warnings={sideBWarnings} />
      </span>
    )
  }

  return (
    <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1">
      <JudgeQueueAthleteLine side={bout.sideA} warnings={sideAWarnings} />
      <span className="self-center text-xs font-medium text-muted">—</span>
      <JudgeQueueAthleteLine side={bout.sideB} warnings={sideBWarnings} />
    </div>
  )
}
