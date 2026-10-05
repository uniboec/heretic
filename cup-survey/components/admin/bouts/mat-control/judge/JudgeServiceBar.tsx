'use client'

import {
  ArrowLeftRight,
  LayoutGrid,
  ListOrdered,
  LogOut,
  Maximize2,
  Minimize2,
  Monitor,
  RotateCcw,
  SkipForward,
  Timer,
  Volume2,
  VolumeX,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { routes } from '@/lib/routes'
import { withBasePath } from '@/lib/basePath'
import {
  formatJudgeBoutHeader,
  shouldShowJudgeBoutStageLabel,
} from '@/lib/bouts/formatJudgeBoutHeader'
import type { BoutSchedulePhase } from '@/lib/bouts/types'
import { ViewBracketCategoryButton } from '@/components/tournament/brackets/ViewBracketCategoryButton'
import { judgeStyles } from './judgeModeStyles'

function ToolbarLabel({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
}) {
  return (
    <span className={`${judgeStyles.toolbarBtn} gap-1.5`}>
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      {label}
    </span>
  )
}

function StatusChip({
  label,
  dotClass,
  chipClass,
}: {
  label: string
  dotClass: string
  chipClass: string
}) {
  return (
    <span className={`${judgeStyles.statusChip} ${chipClass}`}>
      <span className={dotClass} aria-hidden />
      {label}
    </span>
  )
}

export function JudgeServiceBar({
  matIndex,
  categoryKey,
  categoryTitle,
  discipline,
  schedulePhase,
  boutLabel,
  round,
  roundsUntilFinal,
  scheduleDisplayNumber,
  leaseHeld,
  snapshotFresh,
  onTakeover,
  onReleaseLease,
  fullscreen,
  onToggleFullscreen,
  soundEnabled,
  onToggleSound,
  canResetBout,
  canPostponeBout,
  controlsEnabled,
  onResetBout,
  onPostponeBout,
  showSwapCornersButton,
  canSwapCorners,
  onSwapCorners,
  swapCornersDisabledReason,
  canEditBoutTiming,
  onEditBoutTiming,
}: {
  matIndex: number
  categoryKey?: string | null
  categoryTitle?: string
  discipline?: string | null
  schedulePhase?: BoutSchedulePhase | null
  boutLabel?: string | null
  round?: number | null
  roundsUntilFinal?: number | null
  scheduleDisplayNumber?: string | null
  leaseHeld: boolean
  snapshotFresh: boolean
  onTakeover: () => void
  onReleaseLease?: () => void
  fullscreen?: boolean
  onToggleFullscreen?: () => void
  soundEnabled?: boolean
  onToggleSound?: () => void
  canResetBout?: boolean
  canPostponeBout?: boolean
  controlsEnabled?: boolean
  onResetBout?: () => void
  onPostponeBout?: () => void
  showSwapCornersButton?: boolean
  canSwapCorners?: boolean
  onSwapCorners?: () => void
  swapCornersDisabledReason?: string | null
  canEditBoutTiming?: boolean
  onEditBoutTiming?: () => void
}) {
  const header = formatJudgeBoutHeader({
    categoryTitle,
    discipline,
    schedulePhase,
    boutLabel,
    round,
    roundsUntilFinal,
    scheduleDisplayNumber,
  })
  const showStageLabel = shouldShowJudgeBoutStageLabel(
    header.stageLabel,
    scheduleDisplayNumber,
  )

  return (
    <header className={judgeStyles.serviceBar}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold leading-snug text-foreground lg:text-[15px]">
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                Ковёр {matIndex}
              </span>
              {header.matchTitle ? (
                <>
                  <span className="shrink-0 text-muted" aria-hidden>·</span>
                  <span className="shrink-0 font-extrabold tracking-tight">{header.matchTitle}</span>
                </>
              ) : null}
              {showStageLabel && header.stageLabel ? (
                <>
                  <span className="shrink-0 text-muted" aria-hidden>·</span>
                  <span className="shrink-0 rounded-md border border-accent/25 bg-accent/10 px-1.5 py-0.5 text-xs font-bold">
                    {header.stageLabel}
                  </span>
                </>
              ) : null}
              {header.categoryLine ? (
                <>
                  <span className="shrink-0 text-muted" aria-hidden>·</span>
                  <span className="min-w-0 truncate font-semibold text-foreground/90">
                    {header.categoryLine}
                  </span>
                </>
              ) : null}
            </h1>
            {categoryKey ? (
              <ViewBracketCategoryButton
                categoryKey={categoryKey}
                categoryTitle={categoryTitle}
                variant="admin"
                className="shrink-0"
              />
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {leaseHeld ? (
              <StatusChip
                label="Управление"
                dotClass={judgeStyles.statusDotLease}
                chipClass={judgeStyles.statusChipLease}
              />
            ) : (
              <StatusChip
                label="Ковёр занят"
                dotClass={judgeStyles.statusDotBusy}
                chipClass={judgeStyles.statusChipPaused}
              />
            )}
            {leaseHeld ? (
              <StatusChip
                label={snapshotFresh ? 'Онлайн' : 'Нет связи'}
                dotClass={snapshotFresh ? judgeStyles.statusDotOnline : judgeStyles.statusDotOffline}
                chipClass={snapshotFresh ? judgeStyles.statusChipLive : judgeStyles.statusChipOffline}
              />
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {!leaseHeld ? (
            <Button onClick={onTakeover}>Перехватить</Button>
          ) : null}
          <Link
            href={routes.scoreboard(matIndex)}
            target="_blank"
            rel="noopener noreferrer"
            className={judgeStyles.toolbarBtnLg}
          >
            <ToolbarLabel icon={Monitor} label="Табло" />
          </Link>
          <Link href={withBasePath(routes.admin.bouts)} className={judgeStyles.toolbarBtnLg}>
            <ToolbarLabel icon={ListOrdered} label="Поединки" />
          </Link>
          <Link href={withBasePath(routes.admin.brackets)} className={judgeStyles.toolbarBtnLg}>
            <ToolbarLabel icon={LayoutGrid} label="Сетка" />
          </Link>
          {canEditBoutTiming && onEditBoutTiming ? (
            <button
              type="button"
              className={`${judgeStyles.toolbarBtn} gap-1.5`}
              disabled={!controlsEnabled}
              onClick={onEditBoutTiming}
              aria-label="Настройки времени поединка"
            >
              <Timer className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              Время
            </button>
          ) : null}
          {showSwapCornersButton && onSwapCorners ? (
            <button
              type="button"
              className={`${judgeStyles.toolbarBtn} gap-1.5`}
              disabled={!controlsEnabled || !canSwapCorners}
              onClick={onSwapCorners}
              aria-label="Сменить углы"
              title={
                !controlsEnabled || !canSwapCorners
                  ? (swapCornersDisabledReason ?? 'Управление недоступно')
                  : 'Сменить углы'
              }
            >
              <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              Углы
            </button>
          ) : null}
          {onToggleSound ? (
            <button
              type="button"
              className={`${judgeStyles.toolbarBtn} gap-1.5`}
              onClick={onToggleSound}
              aria-pressed={soundEnabled}
              aria-label={soundEnabled ? 'Выключить звук' : 'Включить звук'}
            >
              {soundEnabled ? (
                <Volume2 className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              ) : (
                <VolumeX className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              )}
              {soundEnabled ? 'Звук' : 'Без звука'}
            </button>
          ) : null}
          {onToggleFullscreen ? (
            <button
              type="button"
              className={`${judgeStyles.toolbarBtn} hidden gap-1.5 lg:inline-flex`}
              onClick={onToggleFullscreen}
              aria-pressed={fullscreen}
            >
              {fullscreen ? (
                <Minimize2 className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              ) : (
                <Maximize2 className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              )}
              {fullscreen ? 'Окно' : 'Полный экран'}
            </button>
          ) : null}
          {canPostponeBout && onPostponeBout ? (
            <button
              type="button"
              className={`${judgeStyles.toolbarBtn} gap-1.5`}
              disabled={!controlsEnabled}
              onClick={onPostponeBout}
              aria-label="Перенести поединок"
            >
              <SkipForward className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              Перенос
            </button>
          ) : null}
          {canResetBout && onResetBout ? (
            <button
              type="button"
              className={`${judgeStyles.toolbarBtn} gap-1.5 text-[#B42318] hover:border-[#F04438]/35 hover:bg-[#FFF5F5]`}
              disabled={!controlsEnabled}
              onClick={onResetBout}
              aria-label="Сбросить поединок"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              Сброс
            </button>
          ) : null}
          {leaseHeld && onReleaseLease ? (
            <button
              type="button"
              className={`${judgeStyles.toolbarBtn} gap-1.5`}
              onClick={onReleaseLease}
              aria-label="Освободить управление"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              Освободить
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
