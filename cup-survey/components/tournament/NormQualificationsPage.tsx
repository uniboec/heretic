'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { withBasePath } from '@/lib/basePath'
import { getDisciplineShortLabel } from '@/lib/config/tournament'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import {
  formatPlacementWinsWithCategory,
  NORM_QUALIFICATIONS_DISCLAIMER,
} from '@/lib/rankQualifications/formatResultLabel'
import {
  filterNormQualificationRows,
  formatNormRankFilterLabel,
  listAvailableNormRanks,
  type NormQualificationDisciplineFilter,
  type NormQualificationRankFilter,
} from '@/lib/rankQualifications/sortAndFilter'
import type { NormQualificationsPublicRow, NormQualificationsResponse } from '@/lib/rankQualifications/types'
import { readPublicApiResponse } from '@/lib/tournament/readPublicApiResponse'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  participantsTableUi,
  participantsUi,
} from '@/components/tournament/participantsUiClasses'
import { teamsUi } from '@/components/tournament/teamsUiClasses'
import { tournamentPublicUi } from '@/components/tournament/tournamentPublicUiClasses'

const copy = tournamentPageCopy.normQualifications

type PageState = 'loading' | 'disabled' | 'initial-error' | 'ready'

const disciplineOptions: Array<{ id: NormQualificationDisciplineFilter; label: string }> = [
  { id: 'all', label: copy.filters.disciplineAll },
  { id: 'tactic_control', label: getDisciplineShortLabel('tactic_control') },
  { id: 'close_control', label: getDisciplineShortLabel('close_control') },
]

function NormQualificationsEmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className={cn(tournamentPublicUi.page, tournamentPublicUi.pageStack)}>
      <NormQualificationsHeader />
      <div className={cn(teamsUi.panel, teamsUi.emptyPanel)}>
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mt-2 text-sm text-muted">{description}</p>
      </div>
    </div>
  )
}

function NormQualificationsHeader() {
  return (
    <header className={participantsUi.header}>
      <Link href={withBasePath('/')} className={participantsUi.back}>
        {copy.backToTournament}
      </Link>
      <div className="min-w-0">
        <h1 className={participantsUi.titleCompact}>{copy.title}</h1>
        <p className={participantsUi.descriptionCompact}>{copy.description}</p>
      </div>
    </header>
  )
}

function AthleteCell({ row }: { row: NormQualificationsPublicRow }) {
  const clubLine = [row.clubName?.trim(), row.city?.trim()].filter(Boolean).join(' · ')

  return (
    <div className="grid min-w-0 gap-0.5">
      <p className="font-semibold text-foreground [overflow-wrap:anywhere]">{row.athleteName}</p>
      {clubLine ? (
        <p className="truncate text-sm leading-snug text-muted whitespace-nowrap" title={clubLine}>
          {clubLine}
        </p>
      ) : null}
    </div>
  )
}

function CategoryCell({ row }: { row: NormQualificationsPublicRow }) {
  const sourceBracket =
    row.matchingBrackets.find(
      (bracket) => bracket.placement === row.placement && bracket.wins === row.wins,
    ) ?? row.matchingBrackets[0]
  const extraBrackets = row.matchingBrackets.filter((bracket) => bracket !== sourceBracket)

  const primaryLine = formatPlacementWinsWithCategory(
    row.placement,
    row.wins,
    row.categoryLabel ?? sourceBracket?.categoryLabel,
  )

  return (
    <div className="grid gap-1">
      {primaryLine ? (
        <p className="text-sm leading-snug text-foreground [overflow-wrap:anywhere]">{primaryLine}</p>
      ) : null}
      {extraBrackets.map((bracket) => {
        const line = formatPlacementWinsWithCategory(
          bracket.placement,
          bracket.wins,
          bracket.categoryLabel,
        )
        if (!line) return null
        return (
          <p
            key={bracket.categoryKey}
            className="text-sm leading-snug text-muted [overflow-wrap:anywhere]"
          >
            {line}
          </p>
        )
      })}
    </div>
  )
}

function AchievedCell({ row }: { row: NormQualificationsPublicRow }) {
  return (
    <div className="grid gap-0.5">
      <p className="font-semibold text-foreground">{row.resultLabel}</p>
      <p className="text-sm text-muted">{row.disciplineLabel}</p>
    </div>
  )
}

function NormQualificationRow({ row }: { row: NormQualificationsPublicRow }) {
  return (
    <tr className={participantsTableUi.rowHover}>
      <td className={cn(participantsTableUi.td, 'align-top')}>
        <AthleteCell row={row} />
      </td>
      <td className={cn(participantsTableUi.td, 'align-top')}>
        <AchievedCell row={row} />
      </td>
      <td className={cn(participantsTableUi.td, 'align-top')}>
        <CategoryCell row={row} />
      </td>
    </tr>
  )
}

function NormQualificationMobileCard({ row }: { row: NormQualificationsPublicRow }) {
  return (
    <article className={cn(teamsUi.panel, 'p-4')}>
      <AthleteCell row={row} />
      <div className="mt-3 grid gap-3 border-t border-border pt-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {copy.columns.achieved}
          </p>
          <div className="mt-1">
            <AchievedCell row={row} />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {copy.columns.category}
          </p>
          <div className="mt-1">
            <CategoryCell row={row} />
          </div>
        </div>
      </div>
    </article>
  )
}

function NormQualificationsFilters({
  discipline,
  rank,
  search,
  availableRanks,
  onDisciplineChange,
  onRankChange,
  onSearchChange,
}: {
  discipline: NormQualificationDisciplineFilter
  rank: NormQualificationRankFilter
  search: string
  availableRanks: ReturnType<typeof listAvailableNormRanks>
  onDisciplineChange: (value: NormQualificationDisciplineFilter) => void
  onRankChange: (value: NormQualificationRankFilter) => void
  onSearchChange: (value: string) => void
}) {
  return (
    <section className={cn(tournamentPublicUi.card, participantsUi.panel)}>
      <div className={participantsUi.toolbarWrap}>
        <div className={participantsUi.toolbar}>
          <label className={participantsUi.search}>
            <span className="sr-only">{copy.filters.search}</span>
            <Search className={participantsUi.searchIcon} strokeWidth={1.75} aria-hidden="true" />
            <Input
              controlOnly
              className={participantsUi.searchInput}
              placeholder={copy.filters.searchPlaceholder}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              aria-label={copy.filters.search}
            />
          </label>
        </div>
      </div>

      <div className="space-y-4 border-t border-border px-4 py-4 sm:px-5">
        <div>
          <p className={participantsUi.viewLabel}>{copy.filters.discipline}</p>
          <div className={cn(tournamentPublicUi.chips, 'mt-2')} role="group" aria-label={copy.filters.discipline}>
            {disciplineOptions.map((option) => (
              <Button
                key={option.id}
                type="button"
                variant="ghost"
                className={cn(
                  tournamentPublicUi.chip,
                  discipline === option.id && tournamentPublicUi.chipActive,
                )}
                onClick={() => onDisciplineChange(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <p className={participantsUi.viewLabel}>{copy.filters.rank}</p>
          <div className={cn(tournamentPublicUi.chips, 'mt-2')} role="group" aria-label={copy.filters.rank}>
            <Button
              type="button"
              variant="ghost"
              className={cn(tournamentPublicUi.chip, rank === 'all' && tournamentPublicUi.chipActive)}
              onClick={() => onRankChange('all')}
            >
              {copy.filters.rankAll}
            </Button>
            {availableRanks.map((rankId) => (
              <Button
                key={rankId}
                type="button"
                variant="ghost"
                className={cn(
                  tournamentPublicUi.chip,
                  rank === rankId && tournamentPublicUi.chipActive,
                )}
                onClick={() => onRankChange(rankId)}
              >
                {formatNormRankFilterLabel(rankId)}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function NormQualificationsPage() {
  const [data, setData] = useState<NormQualificationsResponse | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [discipline, setDiscipline] = useState<NormQualificationDisciplineFilter>('all')
  const [rank, setRank] = useState<NormQualificationRankFilter>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      try {
        const response = await fetch(withBasePath('/api/tournament/norm-qualifications'), {
          cache: 'no-store',
          signal: controller.signal,
        })
        const result = await readPublicApiResponse<NormQualificationsResponse>(response)

        if (controller.signal.aborted) return

        if (!result.ok) {
          setPageState('initial-error')
          return
        }

        setData(result.data)
        setPageState(result.data.available ? 'ready' : 'disabled')
      } catch (error) {
        if (controller.signal.aborted) return
        if (error instanceof DOMException && error.name === 'AbortError') return
        setPageState('initial-error')
      }
    }

    void load()
    return () => controller.abort()
  }, [])

  const allRows = data?.rows ?? []
  const availableRanks = useMemo(() => listAvailableNormRanks(allRows), [allRows])
  const filteredRows = useMemo(
    () =>
      filterNormQualificationRows({
        rows: allRows,
        discipline,
        rank,
        search,
      }),
    [allRows, discipline, rank, search],
  )

  if (pageState === 'loading') {
    return (
      <div className={cn(tournamentPublicUi.page, tournamentPublicUi.pageStack)}>
        <NormQualificationsHeader />
        <p className="text-sm text-muted">{copy.loading}</p>
      </div>
    )
  }

  if (pageState === 'disabled') {
    return (
      <NormQualificationsEmptyState
        title={copy.disabledTitle}
        description={copy.disabledDescription}
      />
    )
  }

  if (pageState === 'initial-error') {
    return (
      <NormQualificationsEmptyState
        title={copy.loadErrorTitle}
        description={copy.loadErrorDescription}
      />
    )
  }

  if (allRows.length === 0) {
    return (
      <NormQualificationsEmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
    )
  }

  return (
    <div className={cn(tournamentPublicUi.page, tournamentPublicUi.pageStack)}>
      <NormQualificationsHeader />

      <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
        {data?.disclaimer ?? NORM_QUALIFICATIONS_DISCLAIMER}
      </p>

      <NormQualificationsFilters
        discipline={discipline}
        rank={rank}
        search={search}
        availableRanks={availableRanks}
        onDisciplineChange={setDiscipline}
        onRankChange={setRank}
        onSearchChange={setSearch}
      />

      {filteredRows.length === 0 ? (
        <div className={cn(teamsUi.panel, teamsUi.emptyPanel)}>
          <p className="text-base font-semibold text-foreground">{copy.filters.emptyFilteredTitle}</p>
          <p className="mt-2 text-sm text-muted">{copy.filters.emptyFilteredDescription}</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-background md:block">
            <table className={cn(participantsTableUi.table, 'table-auto')}>
              <thead>
                <tr>
                  <th className={participantsTableUi.th}>{copy.columns.athlete}</th>
                  <th className={participantsTableUi.th}>{copy.columns.achieved}</th>
                  <th className={participantsTableUi.th}>{copy.columns.category}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <NormQualificationRow key={`${row.athleteId}::${row.discipline}`} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {filteredRows.map((row) => (
              <NormQualificationMobileCard key={`${row.athleteId}::${row.discipline}`} row={row} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
