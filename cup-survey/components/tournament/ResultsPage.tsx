'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/cn'
import { routes } from '@/lib/routes'
import { adminPanel } from '@/lib/ui/adminSurfaceStyles'
import { awardsPublicTab, awardsPublicTabs } from '@/lib/ui/awardsUiClasses'
import { withBasePath } from '@/lib/basePath'
import {
  emptyBracketCategoryFilters,
  type BracketCategoryFilterItem,
  type BracketCategoryFilters,
} from '@/lib/brackets/publicCategoryFilters'
import {
  hasActivePublicResultFilters,
  matchesPublicResultRow,
  type PublicResultRow,
  type PublicResultsResponse,
  type PublicResultsStats,
} from '@/lib/brackets/publicResults'
import {
  pluralCategories,
  pluralMedalists,
  tournamentPageCopy,
} from '@/lib/content/tournament-page'
import { readPublicApiResponse } from '@/lib/tournament/readPublicApiResponse'
import { PublicBracketFiltersPanel } from '@/components/tournament/brackets/PublicBracketFiltersPanel'
import { ResultMedalistRow } from '@/components/tournament/brackets/ResultMedalistRow'
import { PublicCategoryBracketHeader } from '@/components/tournament/brackets/PublicCategoryBracketHeader'
import { AthleteRatingBlock } from '@/components/tournament/AthleteRatingBlock'
import { FastestFightsBlock } from '@/components/tournament/FastestFightsBlock'
import { participantsUi } from '@/components/tournament/participantsUiClasses'
import { tournamentPublicUi } from '@/components/tournament/tournamentPublicUiClasses'

const copy = tournamentPageCopy.results
const POLL_INTERVAL_MS = 45_000

type ResultsPageState = 'loading' | 'disabled' | 'initial-error' | 'ready'
type ResultsTab = 'results' | 'rating' | 'fastest'

type TournamentStateSlice = {
  athleteRatingPublicEnabled: boolean
}

function ResultsEmptyState({
  title,
  description,
  showFilters = false,
  categories,
  filters,
  filtersOpen,
  searchQuery,
  filteredCount,
  onFiltersOpenChange,
  onFiltersChange,
  onSearchQueryChange,
}: {
  title: string
  description: string
  showFilters?: boolean
  categories?: BracketCategoryFilterItem[]
  filters?: BracketCategoryFilters
  filtersOpen?: boolean
  searchQuery?: string
  filteredCount?: number
  onFiltersOpenChange?: (open: boolean) => void
  onFiltersChange?: (filters: BracketCategoryFilters) => void
  onSearchQueryChange?: (value: string) => void
}) {
  return (
    <div className={cn(tournamentPublicUi.page, 'event-results-page', tournamentPublicUi.pageStack)}>
      <ResultsHeader statsText={null} />
      {showFilters &&
        categories &&
        filters &&
        typeof filtersOpen === 'boolean' &&
        typeof searchQuery === 'string' &&
        typeof filteredCount === 'number' &&
        onFiltersOpenChange &&
        onFiltersChange &&
        onSearchQueryChange && (
          <PublicBracketFiltersPanel
            categories={categories}
            filters={filters}
            filtersOpen={filtersOpen}
            searchQuery={searchQuery}
            filteredCount={filteredCount}
            filteredCountMode="medalists"
            searchPlaceholder={copy.searchPlaceholder}
            onFiltersOpenChange={onFiltersOpenChange}
            onFiltersChange={onFiltersChange}
            onSearchQueryChange={onSearchQueryChange}
          />
        )}
      <div className={`${adminPanel} p-10 text-center`}>
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mt-2 text-sm text-muted">{description}</p>
      </div>
    </div>
  )
}

function ResultsHeader({ statsText }: { statsText: string | null }) {
  return (
    <header className={participantsUi.header}>
      <Link href={withBasePath('/')} className={participantsUi.back}>
        {copy.backToTournament}
      </Link>
      <div className="min-w-0">
        <h1 className={participantsUi.titleCompact}>{copy.title}</h1>
        <p className={participantsUi.descriptionCompact}>{copy.description}</p>
        {statsText ? (
          <p className="mt-1.5 text-xs font-medium text-foreground">{statsText}</p>
        ) : null}
      </div>
    </header>
  )
}

function buildStatsText(stats: PublicResultsStats): string {
  return copy.statsTemplate(pluralMedalists(stats.medalists), pluralCategories(stats.categoriesWithResults))
}

function ResultsTabs({
  activeTab,
  ratingEnabled,
}: {
  activeTab: ResultsTab
  ratingEnabled: boolean
}) {
  return (
    <nav className={awardsPublicTabs} aria-label="Разделы результатов">
      <Link
        href={withBasePath(routes.results)}
        className={awardsPublicTab(activeTab === 'results')}
      >
        {copy.tabs.results}
      </Link>
      {ratingEnabled ? (
        <Link
          href={withBasePath(routes.resultsRating)}
          className={awardsPublicTab(activeTab === 'rating')}
        >
          {copy.tabs.rating}
        </Link>
      ) : null}
      <Link
        href={withBasePath(routes.resultsFastest)}
        className={awardsPublicTab(activeTab === 'fastest')}
      >
        {copy.tabs.fastest}
      </Link>
    </nav>
  )
}

export function ResultsPage({ tab = 'results' }: { tab?: ResultsTab }) {
  const router = useRouter()
  const activeTab = tab
  const [data, setData] = useState<PublicResultsResponse | null>(null)
  const [pageState, setPageState] = useState<ResultsPageState>('loading')
  const [tournamentState, setTournamentState] = useState<TournamentStateSlice | null>(null)
  const [pollingError, setPollingError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<BracketCategoryFilters>(emptyBracketCategoryFilters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const requestSeqRef = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    const loadState = async () => {
      try {
        const response = await fetch(withBasePath('/api/tournament/state'), {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok || cancelled) return
        const json = (await response.json()) as TournamentStateSlice
        setTournamentState({
          athleteRatingPublicEnabled: Boolean(json.athleteRatingPublicEnabled),
        })
      } catch {
        if (!controller.signal.aborted && !cancelled) {
          setTournamentState({ athleteRatingPublicEnabled: false })
        }
      }
    }

    void loadState()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    let pollTimer: number | undefined

    const applyResponse = (result: PublicResultsResponse, seq: number) => {
      if (cancelled || seq !== requestSeqRef.current) return
      setData(result)
      setPageState('ready')
      setPollingError(false)
    }

    const load = async (isInitial: boolean) => {
      const seq = ++requestSeqRef.current

      try {
        const response = await fetch(withBasePath('/api/tournament/results'), {
          cache: 'no-store',
          signal: controller.signal,
        })
        const result = await readPublicApiResponse<PublicResultsResponse>(response)

        if (cancelled || seq !== requestSeqRef.current) return

        if (result.ok) {
          applyResponse(
            {
              published: Boolean(result.data.published),
              publishedAt: result.data.publishedAt ?? null,
              rows: result.data.rows ?? [],
              filterCategories: result.data.filterCategories ?? [],
              stats: result.data.stats ?? { medalists: 0, categoriesWithResults: 0 },
            },
            seq,
          )
          return
        }

        if (result.kind === 'disabled') {
          setPageState('disabled')
          setData(null)
          return
        }

        if (isInitial) {
          setPageState('initial-error')
        } else {
          setPollingError(true)
        }
      } catch (error) {
        if (controller.signal.aborted || cancelled || seq !== requestSeqRef.current) return
        if (isInitial) {
          setPageState('initial-error')
        } else {
          setPollingError(true)
        }
      }
    }

    void load(true)
    pollTimer = window.setInterval(() => {
      void load(false)
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      controller.abort()
      if (pollTimer !== undefined) {
        window.clearInterval(pollTimer)
      }
    }
  }, [])

  const filterCategories = data?.filterCategories ?? []
  const filtersActive = hasActivePublicResultFilters(filters, searchQuery)

  const filteredRows = useMemo(() => {
    if (!data?.rows.length) return []
    return data.rows.filter((row) => matchesPublicResultRow(row, filters, searchQuery))
  }, [data, filters, searchQuery])

  const filteredStats = useMemo(
    (): PublicResultsStats => ({
      medalists: filteredRows.length,
      categoriesWithResults: new Set(filteredRows.map((row) => row.categoryKey)).size,
    }),
    [filteredRows],
  )

  const groupedRows = useMemo(() => {
    const groups: Array<{ categoryKey: string; categoryTitle: string; rows: PublicResultRow[] }> = []
    const indexByKey = new Map<string, number>()

    for (const row of filteredRows) {
      const existingIndex = indexByKey.get(row.categoryKey)
      if (existingIndex === undefined) {
        indexByKey.set(row.categoryKey, groups.length)
        groups.push({
          categoryKey: row.categoryKey,
          categoryTitle: row.categoryTitle,
          rows: [row],
        })
        continue
      }
      groups[existingIndex]?.rows.push(row)
    }

    return groups
  }, [filteredRows])

  const statsText = useMemo(() => {
    if (!data) return null
    const stats = filtersActive ? filteredStats : data.stats
    if (stats.medalists === 0 && !filtersActive) return null
    return buildStatsText(stats)
  }, [data, filteredStats, filtersActive])

  const ratingEnabled = tournamentState?.athleteRatingPublicEnabled ?? false

  useEffect(() => {
    if (activeTab === 'rating' && tournamentState && !ratingEnabled) {
      router.replace(withBasePath(routes.results))
    }
  }, [activeTab, ratingEnabled, router, tournamentState])

  const pageShell = (content: ReactNode, headerStats: string | null = statsText) => (
    <div className={cn(tournamentPublicUi.page, 'event-results-page', tournamentPublicUi.pageStack)}>
      <ResultsHeader statsText={headerStats} />
      <ResultsTabs activeTab={activeTab} ratingEnabled={ratingEnabled} />
      {content}
    </div>
  )

  if (activeTab === 'rating' && ratingEnabled) {
    return pageShell(<AthleteRatingBlock />, null)
  }

  if (activeTab === 'fastest') {
    return pageShell(<FastestFightsBlock />, null)
  }

  if (pageState === 'loading') {
    return pageShell(
      <div className={`${adminPanel} p-10 text-center`}>
        <p className="text-sm text-muted">{copy.loading}</p>
      </div>,
      null,
    )
  }

  if (pageState === 'disabled') {
    return pageShell(
      <div className={`${adminPanel} p-10 text-center`}>
        <p className="text-base font-semibold text-foreground">{copy.disabledTitle}</p>
        <p className="mt-2 text-sm text-muted">{copy.disabledDescription}</p>
      </div>,
      null,
    )
  }

  if (pageState === 'initial-error') {
    return pageShell(
      <div className={`${adminPanel} p-10 text-center`}>
        <p className="text-base font-semibold text-foreground">{copy.loadErrorTitle}</p>
        <p className="mt-2 text-sm text-muted">{copy.loadErrorDescription}</p>
      </div>,
      null,
    )
  }

  if (!data) {
    return pageShell(
      <div className={`${adminPanel} p-10 text-center`}>
        <p className="text-base font-semibold text-foreground">{copy.loadErrorTitle}</p>
        <p className="mt-2 text-sm text-muted">{copy.loadErrorDescription}</p>
      </div>,
      null,
    )
  }

  if (!data.published) {
    return pageShell(
      <div className={`${adminPanel} p-10 text-center`}>
        <p className="text-base font-semibold text-foreground">{copy.unpublishedTitle}</p>
        <p className="mt-2 text-sm text-muted">{copy.unpublishedDescription}</p>
      </div>,
      null,
    )
  }

  const sharedFilterProps = {
    categories: filterCategories,
    filters,
    filtersOpen,
    searchQuery,
    filteredCount: filteredRows.length,
    filteredCountMode: 'medalists' as const,
    searchPlaceholder: copy.searchPlaceholder,
    onFiltersOpenChange: setFiltersOpen,
    onFiltersChange: setFilters,
    onSearchQueryChange: setSearchQuery,
  }

  if (data.rows.length === 0) {
    return pageShell(
      <>
        {pollingError ? (
          <p className="rounded-lg border border-border bg-surface px-4 py-2 text-xs text-muted">
            {copy.pollingError}
          </p>
        ) : null}
        <PublicBracketFiltersPanel {...sharedFilterProps} />
        <div className={`${adminPanel} p-10 text-center`}>
          <p className="text-base font-semibold text-foreground">{copy.emptyTitle}</p>
          <p className="mt-2 text-sm text-muted">{copy.emptyDescription}</p>
        </div>
      </>,
    )
  }

  return pageShell(
    <>
      {pollingError ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-2 text-xs text-muted">
          {copy.pollingError}
        </p>
      ) : null}

      <PublicBracketFiltersPanel {...sharedFilterProps} />

      {groupedRows.length === 0 ? (
        <div className={`${adminPanel} p-10 text-center`}>
          <p className="text-base font-semibold text-foreground">{copy.filteredEmptyTitle}</p>
          <p className="mt-2 text-sm text-muted">{copy.filteredEmptyDescription}</p>
        </div>
      ) : (
        <div className={cn('space-y-4', tournamentPublicUi.pageStack)}>
          {groupedRows.map((group) => (
            <section key={group.categoryKey} className={cn(adminPanel, 'overflow-hidden')}>
              <PublicCategoryBracketHeader
                categoryKey={group.categoryKey}
                categoryTitle={group.categoryTitle}
                className="border-b border-border px-4 py-3"
              />
              <ol className="bracket-podium__list p-4">
                {group.rows.map((row) => (
                  <ResultMedalistRow
                    key={row.rowKey}
                    placement={row.placement}
                    displayName={row.displayName}
                    clubName={row.clubName}
                    city={row.city}
                    provisional={row.provisional}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </>,
  )
}
