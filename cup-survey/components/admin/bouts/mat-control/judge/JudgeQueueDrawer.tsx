'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { boutHasBothAthletes } from '@/lib/bouts/boutReadiness'
import type { MatQueueEntry } from '@/lib/bouts/matQueue'
import type { MatControlSnapshot } from '@/lib/bouts/matControlSnapshot'

import type { BoutDisplayStatus } from '@/lib/bouts/presentation/boutDisplayStatus'

import { JudgeQueueNextPair } from './JudgeQueueNextPair'
import {
  buildMatQueueDisplayStatusMap,
  countCompletedMatBouts,
  filterMatQueueEntries,
  matQueueDisplayStatusLabel,
} from './judgeQueueFormat'
import { ViewBracketCategoryButton } from '@/components/tournament/brackets/ViewBracketCategoryButton'
import { judgeStyles } from './judgeModeStyles'

function QueueBoutRow({
  entry,
  highlight,
  entryWarnings,
  displayStatus,
  onFocus,
  focusDisabled,
  muted,
}: {
  entry: MatQueueEntry & { isActive?: boolean }
  highlight?: boolean
  entryWarnings: MatControlSnapshot['entryWarnings']
  displayStatus?: BoutDisplayStatus
  onFocus?: (boutId: string) => void
  focusDisabled?: boolean
  muted?: boolean
}) {
  const status = matQueueDisplayStatusLabel(entry, displayStatus)
  const blocked = Boolean(entry.blockedReason) && !entry.isActive
  const canFocus =
    boutHasBothAthletes(entry.bout.sideA, entry.bout.sideB) &&
    !entry.isActive &&
    Boolean(onFocus)

  return (
    <li
      className={`rounded-lg border px-3 py-2.5 ${
        muted
          ? 'border-border bg-surface/80 opacity-80'
          : highlight || entry.isActive
            ? 'border-[#D97706]/40 bg-[#FFF8E8]'
            : blocked
              ? 'border-border bg-surface'
              : 'border-border bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground">
            <span className="tabular-nums text-muted">№{entry.bout.scheduleDisplayNumber}</span>{' '}
            <span className="font-medium text-muted">{entry.bout.categoryTitle}</span>
          </p>
          <div className="mt-2">
            <JudgeQueueNextPair bout={entry.bout} entryWarnings={entryWarnings} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ViewBracketCategoryButton
              categoryKey={entry.bout.categoryKey}
              categoryTitle={entry.bout.categoryTitle}
              variant="admin"
            />
            {canFocus ? (
              <Button
                type="button"
                variant="secondary"
                className="min-h-8 px-2.5 py-1 text-[11px]"
                disabled={focusDisabled}
                onClick={() => onFocus?.(entry.bout.id)}
              >
                Открыть в панели
              </Button>
            ) : null}
          </div>
        </div>
        <span
          className={`shrink-0 text-[10px] font-bold uppercase tracking-[0.04em] ${
            muted || blocked ? 'text-muted' : 'text-success-foreground'
          }`}
        >
          {status}
        </span>
      </div>
    </li>
  )
}

export function JudgeQueueDrawer({
  open,
  snapshot,
  showCompleted,
  onShowCompletedChange,
  onClose,
  onFocusBout,
  focusDisabled,
}: {
  open: boolean
  snapshot: MatControlSnapshot
  showCompleted: boolean
  onShowCompletedChange: (show: boolean) => void
  onClose: () => void
  onFocusBout?: (boutId: string) => void
  focusDisabled?: boolean
}) {
  const displayStatusByBoutId = useMemo(() => buildMatQueueDisplayStatusMap(snapshot), [snapshot])
  const completedCount = useMemo(() => countCompletedMatBouts(snapshot), [snapshot])
  const queueInOrder = snapshot.queueInOrder ?? []
  const visibleEntries = useMemo(
    () => filterMatQueueEntries(queueInOrder, displayStatusByBoutId, showCompleted),
    [queueInOrder, displayStatusByBoutId, showCompleted],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="h-full w-full max-w-md overflow-y-auto bg-background p-4 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-semibold">Очередь ковра</h3>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {completedCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-9 px-2.5 py-1 text-xs"
                onClick={() => onShowCompletedChange(!showCompleted)}
              >
                {showCompleted
                  ? 'Скрыть завершённые'
                  : `Показать завершённые (${completedCount})`}
              </Button>
            ) : null}
            <Button variant="secondary" onClick={onClose}>Закрыть</Button>
          </div>
        </div>

        {visibleEntries.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            {queueInOrder.length === 0
              ? 'Очередь пуста'
              : completedCount > 0 && !showCompleted
                ? 'Нет предстоящих поединков. Включите показ завершённых, чтобы увидеть прошедшие бои.'
                : 'Нет поединков для отображения'}
          </p>
        ) : (
          <section className="mt-4">
            <p className={judgeStyles.historyLabel}>
              {showCompleted ? 'Все поединки на ковре' : 'Предстоящие и текущие'}
            </p>
            <ul className="mt-2 space-y-2">
              {visibleEntries.map((entry) => {
                const displayStatus = displayStatusByBoutId.get(entry.bout.id)
                return (
                  <QueueBoutRow
                    key={entry.bout.id}
                    entry={entry}
                    entryWarnings={snapshot.entryWarnings}
                    displayStatus={displayStatus}
                    muted={displayStatus === 'completed'}
                    onFocus={onFocusBout}
                    focusDisabled={focusDisabled}
                  />
                )
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
