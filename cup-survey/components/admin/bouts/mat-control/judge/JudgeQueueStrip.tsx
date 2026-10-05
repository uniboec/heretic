'use client'

import { BoutDisplayStatusBadge } from '@/components/admin/bouts/BoutDisplayStatusBadge'
import type { MatControlSnapshot } from '@/lib/bouts/matControlSnapshot'

import { JudgeQueueNextPair } from './JudgeQueueNextPair'
import { resolveQueueStripFeatured } from './judgeQueueFormat'
import { ViewBracketCategoryButton } from '@/components/tournament/brackets/ViewBracketCategoryButton'
import { judgeStyles } from './judgeModeStyles'

export function JudgeQueueStrip({
  snapshot,
  muted = false,
  onShowFullQueue,
}: {
  snapshot: MatControlSnapshot
  muted?: boolean
  onShowFullQueue?: () => void
}) {
  const { entry, sectionLabel, displayStatus, laterMatchNumbers } =
    resolveQueueStripFeatured(snapshot)

  return (
    <div className={`${judgeStyles.queueStrip} ${muted ? judgeStyles.queueStripMuted : ''}`}>
      <div className="min-w-0 flex-1 overflow-hidden">
        {entry ? (
          <div
            className="flex min-w-0 items-center gap-2 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex shrink-0 items-center gap-2">
              <span className={judgeStyles.historyLabel}>{sectionLabel}</span>
              <span className="text-muted" aria-hidden>·</span>
              <span className="font-bold tabular-nums text-foreground">
                Бой №{entry.bout.scheduleDisplayNumber}
              </span>
              <BoutDisplayStatusBadge status={displayStatus} />
              {laterMatchNumbers.length > 0 ? (
                <>
                  <span className="text-muted" aria-hidden>·</span>
                  <span className="whitespace-nowrap text-[11px] text-muted">
                    Далее: {laterMatchNumbers.map((num) => `№${num}`).join(', ')}
                  </span>
                </>
              ) : null}
            </div>

            <span className="shrink-0 text-muted" aria-hidden>·</span>

            <div className="shrink-0">
              <JudgeQueueNextPair
                bout={entry.bout}
                entryWarnings={snapshot.entryWarnings}
                compact
              />
            </div>

            <span className="shrink-0 text-muted" aria-hidden>·</span>

            <span className="min-w-0 max-w-[min(36%,20rem)] shrink truncate text-[11px] font-medium text-muted">
              {entry.bout.categoryTitle}
            </span>

            <ViewBracketCategoryButton
              categoryKey={entry.bout.categoryKey}
              categoryTitle={entry.bout.categoryTitle}
              variant="admin"
              label="Сетка"
              className="shrink-0"
            />
          </div>
        ) : (
          <p className="text-sm text-muted">Очередь пуста</p>
        )}
      </div>

      {onShowFullQueue ? (
        <button
          type="button"
          className="shrink-0 self-center text-[11px] font-bold uppercase tracking-[0.04em] text-muted hover:text-foreground"
          onClick={onShowFullQueue}
        >
          Вся очередь →
        </button>
      ) : null}
    </div>
  )
}
