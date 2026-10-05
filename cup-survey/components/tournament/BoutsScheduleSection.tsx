'use client'

import { useMemo, type ReactNode } from 'react'
import { ListOrdered, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { participantsUi } from '@/components/tournament/participantsUiClasses'
import { tournamentPublicUi } from '@/components/tournament/tournamentPublicUiClasses'
import { BoutCard, type BoutCardData } from '@/components/tournament/BoutCard'
import type { StageTimingSummary } from '@/lib/bouts/scheduleTypes'
import {
  buildScheduleRowsWithStageDividers,
  formatStageSummariesHeader,
} from '@/lib/bouts/stageScheduleDividers'
import { MatScheduleRange } from '@/components/tournament/MatScheduleRange'
import { PublicBoutCompletionSwitch } from '@/components/tournament/PublicBoutCompletionSwitch'
import { PublicSegmentedFilter } from '@/components/tournament/PublicSegmentedFilter'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import type { PublicBoutCompletionMode } from '@/lib/bouts/publicBoutCompletion'
import { formatBoutTime } from '@/lib/bouts/startTimes'
import { TOURNAMENT_TIMEZONE } from '@/lib/config/tournament'

export type BoutsMatFilter = 'all' | number

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={participantsUi.stat}>
      <p className={participantsUi.statValue}>{value}</p>
      <p className={participantsUi.statLabel}>{label}</p>
    </div>
  )
}

function BoutsEmptyPanel({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className={participantsUi.empty}>
      <div className={participantsUi.emptyIcon} aria-hidden="true">
        <ListOrdered strokeWidth={1.75} />
      </div>
      <h2 className={participantsUi.emptyTitle}>{title}</h2>
      <p className={participantsUi.emptyText}>{description}</p>
      {action ? <div className={participantsUi.emptyActions}>{action}</div> : null}
    </div>
  )
}

export interface BoutsScheduleSectionProps {
  mats: Array<{
    matIndex: number
    configuredStartTime?: string
    estimatedEndAt?: string | null
    bouts: BoutCardData[]
  }>
  matCount: number
  totalBoutCount: number
  scheduleBouts: BoutCardData[]
  completionMode: PublicBoutCompletionMode
  completionCounts: { active: number; completed: number; all: number }
  onCompletionModeChange: (mode: PublicBoutCompletionMode) => void
  matFilter: BoutsMatFilter
  onMatFilterChange: (filter: BoutsMatFilter) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  visibleBouts: BoutCardData[]
  filteredBouts: BoutCardData[]
  emptyVisibleTitle: string
  emptyVisibleDescription: string
  emptyFilteredDescription?: string
  referenceNow?: Date
  stageSummaries?: StageTimingSummary[]
}

export function BoutsScheduleSection({
  mats,
  matCount,
  totalBoutCount,
  scheduleBouts,
  completionMode,
  completionCounts,
  onCompletionModeChange,
  matFilter,
  onMatFilterChange,
  searchQuery,
  onSearchQueryChange,
  visibleBouts,
  filteredBouts,
  emptyVisibleTitle,
  emptyVisibleDescription,
  emptyFilteredDescription = 'Измените запрос или сбросьте фильтры, чтобы увидеть расписание.',
  referenceNow,
  stageSummaries = [],
}: BoutsScheduleSectionProps) {
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
  const matCountLabel =
    matCount > 1 ? (matCount < 5 ? 'ковра' : 'ковров') : 'ковёр'

  const scheduleBoutCount = scheduleBouts.length

  const matBoutCount = (matIndex: number) =>
    scheduleBouts.filter((bout) => bout.matIndex === matIndex).length

  const hasActiveFilters = searchQuery.trim().length > 0 || matFilter !== 'all'

  const resetFilters = () => {
    onSearchQueryChange('')
    onMatFilterChange('all')
  }

  return (
    <>
      {totalBoutCount > 0 && (
        <div className={cn(participantsUi.statsWrap, 'mb-0')}>
          <div className={cn(participantsUi.statsPrimary, 'max-md:grid-cols-2')}>
            <StatCard label="Поединков" value={scheduleBoutCount} />
            {matCount > 1 && <StatCard label={matCountLabel} value={matCount} />}
          </div>
        </div>
      )}

      {totalBoutCount > 0 && (
        <div className={tournamentPublicUi.boutsFilterPanel}>
          <PublicBoutCompletionSwitch
            mode={completionMode}
            counts={completionCounts}
            onChange={onCompletionModeChange}
          />
          {mats.length > 1 && (
            <PublicSegmentedFilter
              label={tournamentPageCopy.bouts.filterMatLabel}
              ariaLabel="Фильтр по ковру"
              value={matFilter}
              onChange={onMatFilterChange}
              scrollable={mats.length > 2}
              equalWidth={mats.length <= 2}
              options={[
                { value: 'all', label: 'Все ковры', count: scheduleBoutCount },
                ...mats.map((mat) => ({
                  value: mat.matIndex,
                  label: `Ковёр ${mat.matIndex}`,
                  count: matBoutCount(mat.matIndex),
                })),
              ]}
            />
          )}
        </div>
      )}

      <section className={cn(tournamentPublicUi.card, tournamentPublicUi.boutsPanelCard, participantsUi.panel)}>
        {stageSummaryHeader ? (
          <p className="border-b border-border px-4 py-3 text-xs text-muted">{stageSummaryHeader}</p>
        ) : null}
        <div className={participantsUi.toolbarWrap}>
          <div className={cn(participantsUi.toolbar, 'flex-row items-center')}>
            <label className={cn(participantsUi.search, 'flex-1')}>
              <span className="sr-only">Поиск по участнику или категории</span>
              <Search className={participantsUi.searchIcon} strokeWidth={1.75} aria-hidden="true" />
              <Input
                controlOnly
                className={participantsUi.searchInput}
                placeholder="Участник, клуб или категория"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
              />
            </label>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" className={cn(participantsUi.reset, 'shrink-0')} onClick={resetFilters}>
                Сбросить
              </Button>
            )}
          </div>
        </div>

        {visibleBouts.length === 0 ? (
          <BoutsEmptyPanel title={emptyVisibleTitle} description={emptyVisibleDescription} />
        ) : filteredBouts.length === 0 ? (
          <BoutsEmptyPanel
            title="Ничего не найдено"
            description={emptyFilteredDescription}
            action={
              <Button type="button" variant="ghost" className={participantsUi.reset} onClick={resetFilters}>
                Сбросить фильтры
              </Button>
            }
          />
        ) : (
          <>
            {matFilter !== 'all' && (() => {
              const mat = mats.find((item) => item.matIndex === matFilter)
              if (!mat?.configuredStartTime) return null
              const end = mat.estimatedEndAt
                ? formatBoutTime(mat.estimatedEndAt, TOURNAMENT_TIMEZONE)
                : null
              return (
                <div className="space-y-2 px-4 pt-4">
                  <p className="text-sm font-medium text-[var(--color-foreground)]">
                    Ковёр {mat.matIndex}
                  </p>
                  <MatScheduleRange
                    startTime={mat.configuredStartTime}
                    endTime={end}
                  />
                </div>
              )
            })()}
            <div className={tournamentPublicUi.boutsList}>
              {scheduleRows.map((row) =>
                row.kind === 'stage-divider' ? (
                  <div
                    key={`stage-${row.presentation.stage}`}
                    className="border-b border-border px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-[var(--color-foreground)]">
                      {row.presentation.title}
                    </p>
                    {row.presentation.details.length > 0 ? (
                      <p className="mt-1 text-xs text-muted">{row.presentation.details.join(' · ')}</p>
                    ) : null}
                  </div>
                ) : (
                  <BoutCard
                    key={row.bout.id}
                    bout={row.bout}
                    showMatLabel={matFilter === 'all'}
                    referenceNow={referenceNow}
                  />
                ),
              )}
            </div>
          </>
        )}
      </section>
    </>
  )
}
