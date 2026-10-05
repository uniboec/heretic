import { cn } from '@/lib/cn'
import { formatPublicBoutTiming } from '@/lib/bouts/boutTimingPresentation'
import { isPublicBoutCompleted } from '@/lib/bouts/publicBoutCompletion'
import { resolvePublicBoutPlacement } from '@/lib/bouts/publicBoutPlacement'
import type { BoutTiming } from '@/lib/bouts/scheduleTypes'
import type { BoutSchedulePhase } from '@/lib/bouts/types'
import { ViewBracketCategoryButton } from '@/components/tournament/brackets/ViewBracketCategoryButton'
import { PublicBoutPlacementBadge } from '@/components/tournament/PublicBoutPlacementBadge'
import { boutCardUi } from '@/components/tournament/tournamentPublicUiClasses'

export interface BoutSideData {
  kind: 'athlete' | 'hint' | 'bye'
  entryId?: string
  displayName?: string
  clubName?: string
  label?: string
}

export interface BoutCardData {
  id: string
  scheduleDisplayNumber: string
  matIndex: number
  competitionStage?: number
  categoryKey?: string
  categoryTitle: string
  schedulePhase?: BoutSchedulePhase
  label?: string
  sideA: BoutSideData
  sideB: BoutSideData
  timing?: BoutTiming
  winnerEntryId?: string | null
}

function formatLiveClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function outcomeForSide(
  side: BoutSideData,
  winnerEntryId: string | null | undefined,
): 'winner' | 'loser' | null {
  if (!winnerEntryId || side.kind !== 'athlete' || !side.entryId) return null
  if (side.entryId === winnerEntryId) return 'winner'
  return 'loser'
}

export function BoutSide({
  side,
  align,
  outcome,
}: {
  side: BoutSideData
  align: 'left' | 'right'
  outcome?: 'winner' | 'loser' | null
}) {
  const participantClass = cn(
    boutCardUi.participant,
    align === 'left' && boutCardUi.participantLeft,
    align === 'right' && boutCardUi.participantRight,
  )

  const sideClass = cn(
    boutCardUi.side,
    align === 'left' && boutCardUi.sideLeft,
    align === 'right' && boutCardUi.sideRight,
  )

  if (side.kind === 'athlete') {
    const fullTitle = [side.displayName, side.clubName].filter(Boolean).join(' · ')
    return (
      <div className={participantClass} title={fullTitle}>
        <div className={sideClass}>
          {outcome === 'winner' ? (
            <span className={boutCardUi.winnerBadge}>Победитель</span>
          ) : null}
          <p
            className={cn(
              boutCardUi.name,
              outcome === 'winner' && boutCardUi.nameWinner,
              outcome === 'loser' && boutCardUi.nameLoser,
            )}
          >
            {side.displayName || 'Участник'}
          </p>
          {side.clubName ? <p className={boutCardUi.meta}>{side.clubName}</p> : null}
        </div>
      </div>
    )
  }

  if (side.kind === 'hint') {
    return (
      <div className={participantClass}>
        <div className={sideClass}>
          <p className={boutCardUi.pending}>{side.label ?? '—'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={participantClass}>
      <div className={sideClass}>
        <p className={cn(boutCardUi.pending, boutCardUi.pendingBye)}>—</p>
      </div>
    </div>
  )
}

export function BoutCard({
  bout,
  showMatLabel,
  referenceNow,
}: {
  bout: BoutCardData
  showMatLabel: boolean
  referenceNow?: Date
}) {
  const timingPresentation = bout.timing
    ? formatPublicBoutTiming(bout.timing, referenceNow)
    : null
  const placement = resolvePublicBoutPlacement({ schedulePhase: bout.schedulePhase })
  const showWinner =
    isPublicBoutCompleted(bout) && Boolean(bout.winnerEntryId)
  const winnerEntryId = showWinner ? bout.winnerEntryId : null

  const timingMeta = [timingPresentation?.secondary, timingPresentation?.delayLabel].filter(Boolean)

  return (
    <article className={boutCardUi.card}>
      <div
        className="border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_72%,var(--color-card))] px-3 py-2 sm:px-3.5"
      >
        <div className="flex min-w-0 items-center gap-2 overflow-hidden sm:gap-2.5">
          {timingPresentation?.startTime ? (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 shadow-[0_1px_2px_rgb(15_20_25_/_0.04)]',
                timingPresentation.live
                  ? 'border-[color-mix(in_srgb,var(--color-accent)_35%,var(--color-border))] bg-[var(--color-accent-soft)]'
                  : 'border-[var(--color-border)] bg-[var(--color-card)]',
              )}
              aria-label={
                timingPresentation.approximate
                  ? `Примерное время начала ${timingPresentation.startTime}`
                  : `Время начала ${timingPresentation.startTime}`
              }
            >
              {timingPresentation.live ? (
                <span className="text-[0.625rem] font-extrabold text-[var(--color-accent)]">●</span>
              ) : timingPresentation.approximate ? (
                <span className="text-[0.6875rem] font-bold text-[var(--color-muted)]">≈</span>
              ) : null}
              <span
                className={cn(
                  'text-base font-extrabold tabular-nums leading-none sm:text-[1.0625rem]',
                  timingPresentation.live
                    ? 'text-[var(--color-accent)]'
                    : 'text-[var(--color-foreground)]',
                )}
              >
                {timingPresentation.startTime}
              </span>
            </span>
          ) : null}

          <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
            <p className={cn(boutCardUi.category, 'min-w-0 truncate')}>{bout.categoryTitle}</p>
            {bout.categoryKey ? (
              <ViewBracketCategoryButton
                categoryKey={bout.categoryKey}
                categoryTitle={bout.categoryTitle}
                variant="public"
              />
            ) : null}
          </div>

          {timingMeta.length > 0 ? (
            <>
              <span
                className="hidden h-4 w-px shrink-0 bg-[var(--color-border)] md:block"
                aria-hidden="true"
              />
              <span className="hidden max-w-[7rem] shrink-0 truncate text-[0.6875rem] text-[var(--color-muted)] md:inline">
                {timingMeta.join(' · ')}
              </span>
            </>
          ) : null}

          <div className={boutCardUi.headTags}>
            {placement ? <PublicBoutPlacementBadge placement={placement} compact /> : null}
            {timingPresentation?.statusLabel ? (
              <span className={boutCardUi.tag}>{timingPresentation.statusLabel}</span>
            ) : null}
            {showMatLabel && <span className={boutCardUi.tag}>Ковёр {bout.matIndex}</span>}
            {bout.scheduleDisplayNumber && (
              <span className={boutCardUi.order}>Бой {bout.scheduleDisplayNumber}</span>
            )}
          </div>
        </div>

        <div className="mt-1.5 flex min-w-0 items-start gap-2 md:hidden">
          <p className={cn(boutCardUi.categoryMobile, 'min-w-0 flex-1')}>{bout.categoryTitle}</p>
          {bout.categoryKey ? (
            <ViewBracketCategoryButton
              categoryKey={bout.categoryKey}
              categoryTitle={bout.categoryTitle}
              variant="public"
            />
          ) : null}
        </div>
      </div>
      <div className={boutCardUi.faceoff} aria-label="Участник против участника">
        <BoutSide
          side={bout.sideA}
          align="left"
          outcome={outcomeForSide(bout.sideA, winnerEntryId)}
        />
        {bout.timing?.liveScore ? (
          <div className="flex min-w-[5.5rem] flex-col items-center justify-center px-2 text-center">
            <p className="text-2xl font-extrabold tabular-nums text-[var(--color-foreground)] sm:text-3xl">
              {bout.timing.liveScore.red}:{bout.timing.liveScore.blue}
            </p>
            {typeof bout.timing.liveScore.periodRemainingMs === 'number' ? (
              <p className="mt-1 text-xs font-semibold text-[var(--color-accent)]">
                {formatLiveClock(bout.timing.liveScore.periodRemainingMs)}
              </p>
            ) : null}
          </div>
        ) : (
          <span className={boutCardUi.vs} aria-hidden="true">
            VS
          </span>
        )}
        <BoutSide
          side={bout.sideB}
          align="right"
          outcome={outcomeForSide(bout.sideB, winnerEntryId)}
        />
      </div>
    </article>
  )
}
