'use client'

import type { BoutEventRecord } from '@/lib/bouts/mat-control/types'
import type { UndoCandidate } from '@/lib/bouts/getUndoCandidate'

import { getCorrectionPeriodEvents } from './formatCorrectionLogLine'
import { JudgeTimelineJournal } from './JudgeTimelineJournal'

export function JudgeCorrectionJournal({
  events,
  period,
  attemptNumber,
  undoCandidate,
  controlsEnabled,
  onUndo,
  onShowFullHistory,
}: {
  events: BoutEventRecord[]
  period: 'main' | 'extra'
  attemptNumber: number
  undoCandidate: UndoCandidate | null
  controlsEnabled: boolean
  onUndo: () => void
  onShowFullHistory?: () => void
}) {
  const correctionEvents = getCorrectionPeriodEvents(events, period, attemptNumber)

  return (
    <JudgeTimelineJournal
      events={correctionEvents}
      undoCandidate={undoCandidate}
      controlsEnabled={controlsEnabled}
      onUndo={onUndo}
      onShowFullHistory={onShowFullHistory}
      emptyLabel="История пуста"
    />
  )
}
