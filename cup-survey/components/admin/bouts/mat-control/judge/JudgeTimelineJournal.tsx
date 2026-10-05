'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { BoutEventRecord } from '@/lib/bouts/mat-control/types'
import type { UndoCandidate } from '@/lib/bouts/getUndoCandidate'

import { formatUndoCandidate } from '../formatUndoCandidate'

import {
  formatJudgeTimelineEntry,
  type JudgeTimelineEntry,
} from './formatJudgeTimelineEntry'
import { judgeStyles } from './judgeModeStyles'

function headlineClass(entry: JudgeTimelineEntry, isLatest: boolean): string {
  const base = judgeStyles.timelineHeadline
  const latest = isLatest ? ` ${judgeStyles.timelineHeadlineLatest}` : ''
  if (entry.kind === 'score' && entry.corner === 'red') {
    return `${base} ${judgeStyles.timelineHeadlineRed}${latest}`
  }
  if (entry.kind === 'score' && entry.corner === 'blue') {
    return `${base} ${judgeStyles.timelineHeadlineBlue}${latest}`
  }
  if (entry.kind === 'penalty' && entry.corner === 'red') {
    return `${base} ${judgeStyles.timelineHeadlinePenaltyRed}${latest}`
  }
  if (entry.kind === 'penalty' && entry.corner === 'blue') {
    return `${base} ${judgeStyles.timelineHeadlinePenaltyBlue}${latest}`
  }
  return `${base} ${judgeStyles.timelineHeadlineNeutral}${latest}`
}

function chipWrapClass(
  entry: JudgeTimelineEntry,
  isLatest: boolean,
  isEntering: boolean,
): string {
  const base = judgeStyles.timelineChip
  const latest = isLatest ? ` ${judgeStyles.timelineChipLatest}` : ''
  const entering = isEntering ? ` ${judgeStyles.timelineChipEnter}` : ''
  if (entry.corner === 'red') {
    return `${base} ${judgeStyles.timelineChipRed}${latest}${entering}`
  }
  if (entry.corner === 'blue') {
    return `${base} ${judgeStyles.timelineChipBlue}${latest}${entering}`
  }
  return `${base}${latest}${entering}`
}

function TimelineChip({
  entry,
  isLatest,
  isEntering,
}: {
  entry: JudgeTimelineEntry
  isLatest: boolean
  isEntering: boolean
}) {
  const headlineSizeClass =
    entry.headline.length > 3 ? judgeStyles.timelineHeadlineCompact : ''

  return (
    <div className={chipWrapClass(entry, isLatest, isEntering)} title={entry.title}>
      <div
        className={`${headlineClass(entry, isLatest)} ${headlineSizeClass}`}
        aria-hidden
      >
        {entry.headline}
      </div>
      <p className={judgeStyles.timelineSubtitle}>{entry.subtitle}</p>
      <p className={judgeStyles.timelineBoutTime}>{entry.boutTime}</p>
    </div>
  )
}

function scrollTimelineToEnd(node: HTMLDivElement) {
  node.scrollLeft = Math.max(0, node.scrollWidth - node.clientWidth)
}

export function JudgeTimelineJournal({
  events,
  undoCandidate,
  controlsEnabled,
  onUndo,
  onShowFullHistory,
  emptyLabel = 'История пуста',
}: {
  events: BoutEventRecord[]
  undoCandidate?: UndoCandidate | null
  controlsEnabled?: boolean
  onUndo?: () => void
  onShowFullHistory?: () => void
  emptyLabel?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevLatestRef = useRef<string | null>(null)
  const [enteringId, setEnteringId] = useState<string | null>(null)
  const entries = events.map(formatJudgeTimelineEntry)
  const latestEventId = events.length > 0 ? events[events.length - 1]?.id : null
  const undoLabels = undoCandidate ? formatUndoCandidate(undoCandidate) : null
  const showUndo =
    Boolean(onUndo) &&
    Boolean(undoCandidate) &&
    Boolean(undoLabels) &&
    latestEventId != null &&
    undoCandidate!.targetEventIds.includes(latestEventId)

  useLayoutEffect(() => {
    const node = scrollRef.current
    if (!node) return

    const pinToEnd = () => scrollTimelineToEnd(node)

    pinToEnd()
    requestAnimationFrame(pinToEnd)

    const track = node.firstElementChild
    const observer = new ResizeObserver(pinToEnd)
    observer.observe(node)
    if (track) observer.observe(track)

    return () => observer.disconnect()
  }, [entries.length, latestEventId])

  useEffect(() => {
    if (!latestEventId) {
      prevLatestRef.current = null
      return
    }

    if (prevLatestRef.current === null) {
      prevLatestRef.current = latestEventId
      return
    }

    if (latestEventId === prevLatestRef.current) return

    prevLatestRef.current = latestEventId
    setEnteringId(latestEventId)
    const timer = window.setTimeout(() => setEnteringId(null), 220)
    return () => window.clearTimeout(timer)
  }, [latestEventId])

  return (
    <div className={`${judgeStyles.historyStrip} ${judgeStyles.stripDivider}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={judgeStyles.historyLabel}>Журнал</span>
        <div className="flex min-w-0 items-center gap-2">
          {showUndo && onUndo ? (
            <button
              type="button"
              className={`${judgeStyles.toolbarBtn} max-w-[12rem] truncate`}
              disabled={!controlsEnabled}
              onClick={onUndo}
              title={undoLabels?.buttonLabel}
            >
              {undoLabels?.buttonLabel}
            </button>
          ) : null}
          {onShowFullHistory ? (
            <button type="button" className={judgeStyles.toolbarBtn} onClick={onShowFullHistory}>
              История ›
            </button>
          ) : null}
        </div>
      </div>

      {entries.length > 0 ? (
        <div className={judgeStyles.timelineRow}>
          <div className={judgeStyles.timelineScrollViewport}>
            <div ref={scrollRef} className={judgeStyles.timelineScroll}>
              <div className={judgeStyles.timelineScrollTrack}>
                {entries.map((entry, index) => (
                  <div key={entry.id} className="flex shrink-0 items-center">
                    {index > 0 ? (
                      <div className={judgeStyles.timelineConnector} aria-hidden />
                    ) : null}
                    <TimelineChip
                      entry={entry}
                      isLatest={index === entries.length - 1}
                      isEntering={entry.id === enteringId}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className={judgeStyles.timelineEmpty}>{emptyLabel}</p>
      )}
    </div>
  )
}
