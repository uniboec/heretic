'use client'

import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  GripVertical,
  Pin,
  PinOff,
  RotateCcw,
  Search,
  X,
} from 'lucide-react'
import type { BoutScheduleOverrides } from '@/lib/bouts/scheduleOverrides'
import { cn } from '@/lib/cn'
import { formatPublicBoutTiming } from '@/lib/bouts/boutTimingPresentation'
import type { BoutTiming, StageTimingSummary } from '@/lib/bouts/scheduleTypes'
import {
  buildScheduleRowsWithStageDividers,
  formatStageSummariesHeader,
} from '@/lib/bouts/stageScheduleDividers'
import { type BoutCardData } from '@/components/tournament/BoutCard'
import { type BoutsMatFilter } from '@/components/tournament/BoutsScheduleSection'
import { BoutDisplayStatusBadge } from '@/components/admin/bouts/BoutDisplayStatusBadge'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AdminBoutScheduleActions } from '@/components/admin/bouts/AdminBoutScheduleActions'
import { AdminBoutsParticipantsCell } from '@/components/admin/bouts/AdminBoutsParticipantsCell'
import { resolveBoutDisplayStatusFromTiming } from '@/lib/bouts/presentation/boutDisplayStatus'
import {
  adminBracketsTabs,
  adminBoutsCellCategory,
  adminBoutsCellMeta,
  adminBoutsScheduleColCategory,
  adminBoutsScheduleColMat,
  adminBoutsScheduleColNum,
  adminBoutsScheduleColParticipants,
  adminBoutsScheduleColStatus,
  adminBoutsScheduleColTime,
  adminBoutsScheduleWrap,
  adminBoutsScrollPanel,
  adminBoutsToolbarRow,
  adminBoutsToolbarSearch,
  adminPanel,
  adminPanelHeader,
  adminSegmentTab,
  adminTableWrap,
} from '@/lib/ui/adminSurfaceStyles'

function formatTimingCell(timing: BoutTiming | undefined, referenceNow: Date): string {
  if (!timing) return '—'
  const presentation = formatPublicBoutTiming(timing, referenceNow)
  const parts = [
    presentation.startTime
      ? `${presentation.approximate ? '≈' : ''}${presentation.startTime}`
      : null,
    presentation.delayLabel,
  ].filter(Boolean)
  return parts.join(' · ') || presentation.statusLabel
}

export interface AdminBoutsScheduleTableProps {
  mats: Array<{
    matIndex: number
    bouts: BoutCardData[]
  }>
  matCount: number
  totalBoutCount: number
  matFilter: BoutsMatFilter
  onMatFilterChange: (filter: BoutsMatFilter) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  filteredBouts: Array<
    BoutCardData & { categoryKey?: string; competitionStage?: number; timing?: BoutTiming }
  >
  stageSummaries?: StageTimingSummary[]
  showMatColumn: boolean
  emptyTitle: string
  emptyDescription: string
  referenceNow: Date
  scheduleControlsEnabled?: boolean
  scheduleOverrides?: BoutScheduleOverrides
  scheduleSaving?: boolean
  onMoveBout?: (boutId: string, direction: 'up' | 'down') => void
  onReorderMat?: (orderedBoutIds: string[]) => void
  onResetManualOrder?: () => void
  onTogglePin?: (boutId: string, pinnedToEnd: boolean) => void
  onReorderRejected?: (message: string) => void
  bulkSelectionEnabled?: boolean
  selectedBoutIds?: ReadonlySet<string>
  onToggleBoutSelection?: (boutId: string, selected: boolean) => void
  onToggleAllVisibleSelection?: (boutIds: string[], selected: boolean) => void
  onBulkPin?: () => void
  onBulkUnpin?: () => void
  onBulkMoveMat?: () => void
  bulkMoveMatEnabled?: boolean
}

export function AdminBoutsScheduleTable({
  mats,
  matCount,
  totalBoutCount,
  matFilter,
  onMatFilterChange,
  searchQuery,
  onSearchQueryChange,
  filteredBouts,
  stageSummaries = [],
  showMatColumn,
  emptyTitle,
  emptyDescription,
  referenceNow,
  scheduleControlsEnabled = false,
  scheduleOverrides = {},
  scheduleSaving = false,
  onMoveBout,
  onReorderMat,
  onResetManualOrder,
  onTogglePin,
  onReorderRejected,
  bulkSelectionEnabled = false,
  selectedBoutIds = new Set<string>(),
  onToggleBoutSelection,
  onToggleAllVisibleSelection,
  onBulkPin,
  onBulkUnpin,
  onBulkMoveMat,
  bulkMoveMatEnabled = false,
}: AdminBoutsScheduleTableProps) {
  const [dragBoutId, setDragBoutId] = useState<string | null>(null)
  const [dragOverBoutId, setDragOverBoutId] = useState<string | null>(null)
  const stageSummaryHeader = useMemo(
    () => formatStageSummariesHeader(stageSummaries),
    [stageSummaries],
  )
  const scheduleRows = useMemo(
    () =>
      buildScheduleRowsWithStageDividers(
        filteredBouts.map((bout) => ({
          ...bout,
          competitionStage: bout.competitionStage ?? 1,
        })),
        stageSummaries,
      ),
    [filteredBouts, stageSummaries],
  )
  let boutOrdinal = 0
  const selectableBoutIds = useMemo(
    () =>
      filteredBouts
        .filter((bout) => {
          const status = resolveBoutDisplayStatusFromTiming(bout.timing)
          return status !== 'completed' && status !== 'in_progress'
        })
        .map((bout) => bout.id),
    [filteredBouts],
  )
  const allVisibleSelected =
    selectableBoutIds.length > 0 && selectableBoutIds.every((boutId) => selectedBoutIds.has(boutId))
  const someVisibleSelected = selectableBoutIds.some((boutId) => selectedBoutIds.has(boutId))
  const selectedCount = selectedBoutIds.size
  const columnCount =
    6 +
    (showMatColumn ? 1 : 0) +
    (scheduleControlsEnabled ? 1 : 0) +
    (bulkSelectionEnabled ? 1 : 0)

  function rejectCrossStageReorder(
    dragged: (typeof filteredBouts)[number] | undefined,
    target: (typeof filteredBouts)[number],
  ): boolean {
    if (!dragged || dragged.competitionStage === target.competitionStage) return false
    onReorderRejected?.(
      'Перестановка возможна только внутри одного этапа. Измените «Этап проведения» у категории в разделе «Сетки».',
    )
    return true
  }
  const hasActiveFilters = searchQuery.trim().length > 0 || matFilter !== 'all'
  const hasManualOrderOnMat =
    scheduleControlsEnabled &&
    filteredBouts.some((bout) => typeof scheduleOverrides[bout.id]?.manualOrder === 'number')

  return (
    <section className={`${adminPanel} overflow-hidden`}>
      <div className={adminPanelHeader}>
        <div>Расписание поединков ({totalBoutCount})</div>
        {stageSummaryHeader ? (
          <p className="mt-1 text-xs font-normal text-muted">{stageSummaryHeader}</p>
        ) : null}
      </div>

      <div className="border-b border-border px-4 py-3.5">
        {mats.length > 1 ? (
          <div className={cn(adminBracketsTabs, 'mb-3')} role="group" aria-label="Фильтр по ковру">
            <Button
              type="button"
              variant="ghost"
              className={adminSegmentTab(matFilter === 'all')}
              onClick={() => onMatFilterChange('all')}
            >
              Все ({totalBoutCount})
            </Button>
            {mats.map((mat) => (
              <Button
                key={mat.matIndex}
                type="button"
                variant="ghost"
                className={adminSegmentTab(matFilter === mat.matIndex)}
                onClick={() => onMatFilterChange(mat.matIndex)}
              >
                Ковёр {mat.matIndex} ({mat.bouts.length})
              </Button>
            ))}
          </div>
        ) : null}

        <div className={adminBoutsToolbarRow}>
          <div className={adminBoutsToolbarSearch}>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <Input
              controlOnly
              type="search"
              density="compact"
              className="w-full min-h-10 rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 hover:border-foreground/20 focus:border-accent focus:ring-2 focus:ring-accent/20"
              placeholder="Поиск по участникам, клубу, категории…"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              aria-label="Поиск поединков"
            />
          </div>

          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-9 shrink-0 px-3 py-1.5 text-xs"
              onClick={() => {
                onSearchQueryChange('')
                onMatFilterChange('all')
              }}
            >
              <X className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              Сбросить
            </Button>
          ) : null}
        </div>

        {bulkSelectionEnabled && selectedCount > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-xs font-medium text-foreground">Выбрано: {selectedCount}</span>
            {onBulkPin ? (
              <Button
                type="button"
                variant="secondary"
                className="min-h-9 px-3 py-1.5 text-xs"
                disabled={scheduleSaving}
                onClick={() => onBulkPin()}
              >
                <Pin className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                Закрепить
              </Button>
            ) : null}
            {onBulkUnpin ? (
              <Button
                type="button"
                variant="secondary"
                className="min-h-9 px-3 py-1.5 text-xs"
                disabled={scheduleSaving}
                onClick={() => onBulkUnpin()}
              >
                <PinOff className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                Открепить
              </Button>
            ) : null}
            {bulkMoveMatEnabled && onBulkMoveMat ? (
              <Button
                type="button"
                variant="secondary"
                className="min-h-9 px-3 py-1.5 text-xs"
                disabled={scheduleSaving}
                onClick={() => onBulkMoveMat()}
              >
                <ArrowRightLeft className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                На другой ковёр
              </Button>
            ) : null}
          </div>
        ) : null}

        {hasManualOrderOnMat && onResetManualOrder ? (
          <div className="mt-3 border-t border-border pt-3">
            <Button
              type="button"
              variant="secondary"
              className="min-h-9 px-3 py-1.5 text-xs"
              disabled={scheduleSaving}
              onClick={() => onResetManualOrder()}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              Сбросить ручной порядок
            </Button>
          </div>
        ) : null}
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2">
          {matFilter !== 'all' && (
            <span className="inline-flex items-center rounded-full border border-border bg-background-soft px-2.5 py-1 text-xs font-medium text-foreground">
              Ковёр {matFilter}
            </span>
          )}
          {searchQuery.trim() && (
            <span className="inline-flex items-center rounded-full border border-border bg-background-soft px-2.5 py-1 text-xs font-medium text-foreground">
              Поиск: «{searchQuery.trim()}»
            </span>
          )}
        </div>
      )}

      {filteredBouts.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
          <p className="mt-2 text-sm text-muted">{emptyDescription}</p>
        </div>
      ) : (
        <div className={cn(adminTableWrap, adminBoutsScrollPanel, adminBoutsScheduleWrap)}>
          <Table>
            <thead>
              <tr>
                {bulkSelectionEnabled ? (
                  <th className="w-10 px-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={allVisibleSelected}
                      ref={(element) => {
                        if (element) element.indeterminate = someVisibleSelected && !allVisibleSelected
                      }}
                      disabled={scheduleSaving || selectableBoutIds.length === 0}
                      aria-label="Выбрать все видимые поединки"
                      onChange={(event) =>
                        onToggleAllVisibleSelection?.(selectableBoutIds, event.target.checked)
                      }
                    />
                  </th>
                ) : null}
                <th className={adminBoutsScheduleColNum}>№</th>
                <th className={adminBoutsScheduleColTime}>Время</th>
                {showMatColumn && <th className={adminBoutsScheduleColMat}>Ковёр</th>}
                <th className={adminBoutsScheduleColCategory}>Категория</th>
                <th className={adminBoutsScheduleColParticipants}>Участники</th>
                <th className={adminBoutsScheduleColStatus}>Статус</th>
                <th className="w-[4.5rem] text-right">
                  <span className="sr-only">Действия</span>
                </th>
                {scheduleControlsEnabled ? <th className="w-[7.5rem]">Порядок</th> : null}
              </tr>
            </thead>
            <tbody>
              {scheduleRows.map((row) => {
                if (row.kind === 'stage-divider') {
                  return (
                    <tr key={`stage-${row.presentation.stage}`} className="bg-muted/20">
                      <td colSpan={columnCount} className="px-3 py-3">
                        <p className="text-sm font-semibold text-foreground">{row.presentation.title}</p>
                        {row.presentation.details.length > 0 ? (
                          <p className="mt-1 text-xs text-muted">{row.presentation.details.join(' · ')}</p>
                        ) : null}
                      </td>
                    </tr>
                  )
                }

                const bout = row.bout
                const displayStatus = resolveBoutDisplayStatusFromTiming(bout.timing)
                const selectable =
                  displayStatus !== 'completed' && displayStatus !== 'in_progress'
                const isSelected = selectedBoutIds.has(bout.id)
                boutOrdinal += 1
                const index = boutOrdinal - 1
                const pinned = scheduleOverrides[bout.id]?.pinnedToEnd === true
                const isDragging = dragBoutId === bout.id
                const isDropTarget = dragOverBoutId === bout.id && dragBoutId !== bout.id
                const draggedBout = dragBoutId
                  ? filteredBouts.find((entry) => entry.id === dragBoutId)
                  : undefined
                const timingLabel = formatTimingCell(bout.timing, referenceNow)
                return (
                  <tr
                    key={bout.id}
                    draggable={scheduleControlsEnabled && !scheduleSaving}
                    onDragStart={() => setDragBoutId(bout.id)}
                    onDragEnd={() => {
                      setDragBoutId(null)
                      setDragOverBoutId(null)
                    }}
                    onDragOver={(event) => {
                      if (!scheduleControlsEnabled || !dragBoutId || dragBoutId === bout.id) return
                      if (rejectCrossStageReorder(draggedBout, bout)) return
                      event.preventDefault()
                      setDragOverBoutId(bout.id)
                    }}
                    onDragLeave={() => {
                      if (dragOverBoutId === bout.id) setDragOverBoutId(null)
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      if (!dragBoutId || !onReorderMat || dragBoutId === bout.id) return
                      if (rejectCrossStageReorder(draggedBout, bout)) {
                        setDragBoutId(null)
                        setDragOverBoutId(null)
                        return
                      }
                      const orderedIds = filteredBouts.map((entry) => entry.id)
                      const fromIndex = orderedIds.indexOf(dragBoutId)
                      const toIndex = orderedIds.indexOf(bout.id)
                      if (fromIndex < 0 || toIndex < 0) return
                      const nextOrder = [...orderedIds]
                      const [removed] = nextOrder.splice(fromIndex, 1)
                      nextOrder.splice(toIndex, 0, removed!)
                      setDragBoutId(null)
                      setDragOverBoutId(null)
                      onReorderMat(nextOrder)
                    }}
                    className={cn(
                      isDragging && 'opacity-50',
                      isDropTarget && 'bg-accent/10',
                      isSelected && 'bg-accent/5',
                    )}
                  >
                    {bulkSelectionEnabled ? (
                      <td className="px-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border"
                          checked={isSelected}
                          disabled={scheduleSaving || !selectable}
                          aria-label={`Выбрать бой №${bout.scheduleDisplayNumber}`}
                          onChange={(event) =>
                            onToggleBoutSelection?.(bout.id, event.target.checked)
                          }
                        />
                      </td>
                    ) : null}
                    <td className="text-muted tabular-nums">{bout.scheduleDisplayNumber}</td>
                    <td className={cn(adminBoutsScheduleColTime, 'text-muted')} title={timingLabel}>
                      {timingLabel}
                    </td>
                    {showMatColumn && <td className="text-muted">{bout.matIndex}</td>}
                    <td>
                      <div className={adminBoutsCellCategory} title={bout.categoryTitle}>
                        {bout.categoryTitle}
                      </div>
                      {bout.label ? (
                        <div className={adminBoutsCellMeta}>{bout.label}</div>
                      ) : null}
                    </td>
                    <td className={adminBoutsScheduleColParticipants}>
                      <AdminBoutsParticipantsCell sideA={bout.sideA} sideB={bout.sideB} />
                    </td>
                    <td className={adminBoutsScheduleColStatus}>
                      <BoutDisplayStatusBadge timing={bout.timing} />
                    </td>
                    <td className="text-right">
                      <AdminBoutScheduleActions
                        matIndex={bout.matIndex}
                        boutId={bout.id}
                        categoryKey={bout.categoryKey}
                        categoryTitle={bout.categoryTitle}
                        sideA={bout.sideA}
                        sideB={bout.sideB}
                        displayStatus={displayStatus}
                      />
                    </td>
                    {scheduleControlsEnabled ? (
                      <td>
                        <div
                          className="flex items-center gap-1"
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          <span
                            className="flex h-8 w-6 cursor-grab items-center justify-center text-muted active:cursor-grabbing"
                            aria-hidden="true"
                          >
                            <GripVertical className="h-4 w-4" strokeWidth={1.75} />
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            disabled={scheduleSaving || index === 0 || !onMoveBout}
                            aria-label="Переместить выше"
                            onClick={() => onMoveBout?.(bout.id, 'up')}
                          >
                            <ArrowUp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            disabled={
                              scheduleSaving ||
                              index === filteredBouts.length - 1 ||
                              !onMoveBout
                            }
                            aria-label="Переместить ниже"
                            onClick={() => onMoveBout?.(bout.id, 'down')}
                          >
                            <ArrowDown className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            disabled={scheduleSaving || !onTogglePin}
                            aria-label={pinned ? 'Открепить от конца' : 'Закрепить в конце'}
                            onClick={() => onTogglePin?.(bout.id, !pinned)}
                          >
                            {pinned ? (
                              <PinOff className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                            ) : (
                              <Pin className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                            )}
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      )}

      {filteredBouts.length > 0 && matCount > 1 && matFilter === 'all' && (
        <p className="border-t border-border px-4 py-2 text-xs text-muted">
          Показано {filteredBouts.length} из {totalBoutCount} поединков на {matCount} коврах.
        </p>
      )}
    </section>
  )
}
