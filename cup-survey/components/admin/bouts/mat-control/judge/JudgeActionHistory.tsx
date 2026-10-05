'use client'

import type { BoutEventRecord } from '@/lib/bouts/mat-control/types'
import type { UndoCandidate } from '@/lib/bouts/getUndoCandidate'

import { getJudgeTimelineEvents } from './formatJudgeTimelineEntry'
import { JudgeTimelineJournal } from './JudgeTimelineJournal'

export function JudgeActionHistory({
  events,
  attemptNumber,
  undoCandidate,
  controlsEnabled,
  onUndo,
  onShowFullHistory,
}: {
  events: BoutEventRecord[]
  attemptNumber: number
  undoCandidate: UndoCandidate | null
  controlsEnabled: boolean
  onUndo: () => void
  onShowFullHistory?: () => void
}) {
  const timelineEvents = getJudgeTimelineEvents(events, attemptNumber)

  return (
    <JudgeTimelineJournal
      events={timelineEvents}
      undoCandidate={undoCandidate}
      controlsEnabled={controlsEnabled}
      onUndo={onUndo}
      onShowFullHistory={onShowFullHistory}
    />
  )
}
