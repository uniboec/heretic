'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { withBasePath } from '@/lib/basePath'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import { readPublicApiResponse } from '@/lib/tournament/readPublicApiResponse'
import {
  emptyBracketCategoryFilters,
  type BracketCategoryFilters,
} from '@/lib/brackets/publicCategoryFilters'
import {
  buildAwardsFilterCategories,
  countFilteredAwardPlacements,
  filterAwardCategories,
} from '@/lib/awards/publicAwardsFilters'
import { participantsUi } from '@/components/tournament/participantsUiClasses'
import { tournamentPublicUi } from '@/components/tournament/tournamentPublicUiClasses'
import { PublicBracketFiltersPanel } from '@/components/tournament/brackets/PublicBracketFiltersPanel'
import {
  awardsMedalBadge,
  awardsPublicCategoryCard,
  awardsPublicCategoryComment,
  awardsPublicCategoryHead,
  awardsPublicCategoryTitle,
  awardsPublicPage,
  awardsPublicPlacementClub,
  awardsPublicPlacementName,
  awardsPublicPlacementRow,
  awardsPublicPlacements,
  awardsPublicStatusPill,
  awardsPublicTab,
  awardsPublicTabs,
  awardsPublicTimeValue,
} from '@/lib/ui/awardsUiClasses'
import { eventCard } from '@/lib/ui/eventSurfaceStyles'
import { cn } from '@/lib/cn'
import type { PublicAwardsResponse } from '@/lib/awards/dto/public'
import { defaultPublicAwardsTab } from '@/lib/tournament/publicCompletionDefaults'
import { PublicCategoryBracketHeader } from '@/components/tournament/brackets/PublicCategoryBracketHeader'

const copy = tournamentPageCopy.awardsCeremony
const POLL_INTERVAL_MS = 20_000

type PageState = 'loading' | 'disabled' | 'initial-error' | 'ready'
type PublicTab = 'queue' | 'completed'

function medalEmoji(placement: number) {
  if (placement === 1) return '🥇'
  if (placement === 2) return '🥈'
  return '🥉'
}

function placementStatusLabel(status: 'PENDING' | 'AWARDED' | 'NOT_AWARDED') {
  if (status === 'AWARDED') return 'Вручено'
  if (status === 'NOT_AWARDED') return 'Не вручено'
  return 'Ожидает'
}

function statusPillClass(status: 'PENDING' | 'AWARDED' | 'NOT_AWARDED') {
  if (status === 'AWARDED') return 'bg-success-soft/70 text-success'
  if (status === 'NOT_AWARDED') return 'bg-neutral-soft text-muted'
  return 'bg-background-soft text-muted'
}

function AwardsEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className={tournamentPublicUi.page}>
      <header className={participantsUi.header}>
        <Link href={withBasePath('/')} className={participantsUi.back}>
          {copy.backToTournament}
        </Link>
        <h1 className={participantsUi.title}>{copy.title}</h1>
        <p className={participantsUi.description}>{description}</p>
      </header>
      <div className={`${eventCard} p-8 text-center sm:p-10`}>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
      </div>
    </div>
  )
}

export function AwardsPage() {
  const [state, setState] = useState<PageState>('loading')
  const [data, setData] = useState<PublicAwardsResponse | null>(null)
  const [pollError, setPollError] = useState(false)
  const [activeTabOverride, setActiveTabOverride] = useState<PublicTab | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<BracketCategoryFilters>(emptyBracketCategoryFilters)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load(isInitial: boolean) {
      try {
        const response = await fetch(withBasePath('/api/tournament/awards'), {
          cache: 'no-store',
        })
        const result = await readPublicApiResponse<PublicAwardsResponse>(response)
        if (cancelled) return

        if (!result.ok && result.kind === 'disabled') {
          setState('disabled')
          return
        }
        if (!result.ok || !result.data) {
          if (isInitial) setState('initial-error')
          else setPollError(true)
          return
        }

        setPollError(false)
        setData(result.data)
        setState('ready')
      } catch {
        if (cancelled) return
        if (isInitial) setState('initial-error')
        else setPollError(true)
      }
    }

    void load(true)
    const timer = window.setInterval(() => void load(false), POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const filterCategories = useMemo(
    () => (data ? buildAwardsFilterCategories(data) : []),
    [data],
  )

  const filteredQueue = useMemo(
    () => (data ? filterAwardCategories(data.queue, filters, searchQuery) : []),
    [data, filters, searchQuery],
  )

  const filteredCompleted = useMemo(
    () => (data ? filterAwardCategories(data.completed, filters, searchQuery) : []),
    [data, filters, searchQuery],
  )

  const activeTab =
    activeTabOverride ??
    (data
      ? defaultPublicAwardsTab({
          queueCount: data.queue.length,
          completedCount: data.completed.length,
        })
      : 'queue')

  const tabItems = activeTab === 'queue' ? filteredQueue : filteredCompleted
  const sourceTabItems = activeTab === 'queue' ? data?.queue ?? [] : data?.completed ?? []
  const filteredPlacementCount = countFilteredAwardPlacements(sourceTabItems, filters, searchQuery)

  if (state === 'loading') {
    return <AwardsEmptyState title={copy.loading} description={copy.description} />
  }

  if (state === 'disabled') {
    return (
      <AwardsEmptyState title={copy.disabledTitle} description={copy.disabledDescription} />
    )
  }

  if (state === 'initial-error') {
    return (
      <AwardsEmptyState title={copy.loadErrorTitle} description={copy.loadErrorDescription} />
    )
  }

  if (!data || (data.queue.length === 0 && data.completed.length === 0)) {
    return <AwardsEmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
  }

  return (
    <div className={cn(tournamentPublicUi.page, tournamentPublicUi.pageStack)}>
      <header className={participantsUi.header}>
        <Link href={withBasePath('/')} className={participantsUi.back}>
          {copy.backToTournament}
        </Link>
        <h1 className={participantsUi.title}>{copy.title}</h1>
        <p className={participantsUi.description}>
          {copy.description}
          {pollError ? ` ${copy.pollingError}` : ''}
        </p>
      </header>

      <div className={awardsPublicTabs}>
        <button
          type="button"
          className={awardsPublicTab(activeTab === 'queue')}
          onClick={() => setActiveTabOverride('queue')}
        >
          Очередь
          {data.queue.length > 0 ? ` (${data.queue.length})` : ''}
        </button>
        <button
          type="button"
          className={awardsPublicTab(activeTab === 'completed')}
          onClick={() => setActiveTabOverride('completed')}
        >
          Награждённые
          {data.completed.length > 0 ? ` (${data.completed.length})` : ''}
        </button>
      </div>

      <PublicBracketFiltersPanel
        categories={filterCategories}
        filters={filters}
        filtersOpen={filtersOpen}
        searchQuery={searchQuery}
        filteredCount={filteredPlacementCount}
        filteredCountMode="medalists"
        searchPlaceholder={copy.searchPlaceholder}
        onFiltersOpenChange={setFiltersOpen}
        onFiltersChange={setFilters}
        onSearchQueryChange={setSearchQuery}
      />

      {sourceTabItems.length === 0 ? (
        <div className={`${eventCard} p-5 text-center`}>
          <p className="text-sm text-muted">
            {activeTab === 'queue'
              ? 'Очередь награждения пока пуста.'
              : 'Завершённых награждений пока нет.'}
          </p>
        </div>
      ) : tabItems.length === 0 ? (
        <div className={`${eventCard} p-8 text-center sm:p-10`}>
          <p className="text-sm font-semibold text-foreground">{copy.filteredEmptyTitle}</p>
          <p className="mt-2 text-sm text-muted">{copy.filteredEmptyDescription}</p>
        </div>
      ) : (
        <div className={awardsPublicPage}>
          {activeTab === 'queue'
            ? tabItems.map((category) => (
                <article key={category.queueId} className={awardsPublicCategoryCard}>
                  <div className={awardsPublicCategoryHead}>
                    <PublicCategoryBracketHeader
                      layout="stacked"
                      categoryKey={category.categoryKey}
                      categoryTitle={category.categoryTitle}
                      titleClassName={awardsPublicCategoryTitle}
                      trailing={
                        <p className={awardsPublicTimeValue}>{category.estimatedTimeLabel}</p>
                      }
                    />
                    {category.publicComment ? (
                      <p className={awardsPublicCategoryComment}>{category.publicComment}</p>
                    ) : null}
                  </div>
                  <ul className={awardsPublicPlacements}>
                    {category.placements.map((placement) => (
                      <li key={placement.id} className={awardsPublicPlacementRow}>
                        <span className={awardsMedalBadge(placement.placement)} aria-hidden>
                          {medalEmoji(placement.placement)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={awardsPublicPlacementName}>{placement.displayName}</p>
                          {placement.publicComment ? (
                            <p className="mt-0.5 text-xs leading-snug text-muted">
                              {placement.publicComment}
                            </p>
                          ) : null}
                        </div>
                        <span className={awardsPublicPlacementClub}>{placement.clubName}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))
            : tabItems.map((category) => (
                <article key={category.queueId} className={awardsPublicCategoryCard}>
                  <div className={awardsPublicCategoryHead}>
                    <PublicCategoryBracketHeader
                      layout="stacked"
                      categoryKey={category.categoryKey}
                      categoryTitle={category.categoryTitle}
                      titleClassName={awardsPublicCategoryTitle}
                    />
                    {category.publicComment ? (
                      <p className={awardsPublicCategoryComment}>{category.publicComment}</p>
                    ) : null}
                    <p className="text-xs text-muted">
                      Награждение завершено в {category.completedAtLabel}
                    </p>
                  </div>
                  <ul className={awardsPublicPlacements}>
                    {category.placements.map((placement) => (
                      <li key={placement.id} className={awardsPublicPlacementRow}>
                        <span className={awardsMedalBadge(placement.placement)} aria-hidden>
                          {medalEmoji(placement.placement)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={awardsPublicPlacementName}>{placement.displayName}</p>
                          {placement.publicComment ? (
                            <p className="mt-0.5 text-xs leading-snug text-muted">
                              {placement.publicComment}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <span
                            className={cn(awardsPublicStatusPill, statusPillClass(placement.status))}
                          >
                            {placementStatusLabel(placement.status)}
                          </span>
                          <p className={cn(awardsPublicPlacementClub, 'mt-0.5')}>
                            {placement.clubName}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
        </div>
      )}
    </div>
  )
}
