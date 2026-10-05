'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { adminPanel } from '@/lib/ui/adminSurfaceStyles'
import { withBasePath } from '@/lib/basePath'
import { getDisciplineShortLabel } from '@/lib/config/tournament'
import { pluralClubs, tournamentPageCopy } from '@/lib/content/tournament-page'
import { TEAM_RANKING_DISCIPLINE_ALL } from '@/lib/teamRankings/discipline'
import { formatTeamRankingTieBreakRule } from '@/lib/teamRankings/formatTeamRankingTieBreakRule'
import type {
  TeamRankingDisciplineFilter,
  TeamRankingRow,
  TeamRankingsResponse,
} from '@/lib/teamRankings/types'
import { readPublicApiResponse } from '@/lib/tournament/readPublicApiResponse'
import { Button } from '@/components/ui/Button'
import {
  participantsCardUi,
  participantsTableUi,
  participantsUi,
} from '@/components/tournament/participantsUiClasses'
import { teamsUi } from '@/components/tournament/teamsUiClasses'
import { tournamentPublicUi } from '@/components/tournament/tournamentPublicUiClasses'

const copy = tournamentPageCopy.teams
const POLL_INTERVAL_MS = 45_000

type TeamsPageState = 'loading' | 'disabled' | 'initial-error' | 'ready'

type DisciplineOption = {
  id: TeamRankingDisciplineFilter
  label: string
  shortLabel: string
}

const disciplineOptions: DisciplineOption[] = [
  { id: TEAM_RANKING_DISCIPLINE_ALL, label: copy.disciplineAll, shortLabel: 'Все' },
  {
    id: 'tactic_control',
    label: getDisciplineShortLabel('tactic_control'),
    shortLabel: 'Тактик',
  },
  {
    id: 'close_control',
    label: getDisciplineShortLabel('close_control'),
    shortLabel: 'Клоус',
  },
]

function TeamsEmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className={cn(tournamentPublicUi.page, 'event-teams-page', tournamentPublicUi.pageStack)}>
      <TeamsHeader publishedAt={null} statsText={null} />
      <div className={cn(teamsUi.panel, teamsUi.emptyPanel)}>
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mt-2 text-sm text-muted">{description}</p>
      </div>
    </div>
  )
}

function TeamsHeader({
  publishedAt,
  statsText,
}: {
  publishedAt: string | null
  statsText: string | null
}) {
  return (
    <header className={participantsUi.header}>
      <Link href={withBasePath('/')} className={teamsUi.backMobile}>
        {copy.backToTournament}
      </Link>
      <Link href={withBasePath('/')} className={participantsUi.back}>
        {copy.backToTournament}
      </Link>
      <div className="min-w-0">
        <h1 className={participantsUi.titleCompact}>{copy.title}</h1>
        <p className={participantsUi.descriptionCompact}>{copy.description}</p>
        {statsText ? (
          <p className="mt-1.5 text-xs font-medium text-foreground sm:text-sm">{statsText}</p>
        ) : null}
        {publishedAt ? (
          <p className="mt-1.5 text-[0.6875rem] text-muted sm:text-xs">
            Опубликовано {new Date(publishedAt).toLocaleString('ru-RU')}
          </p>
        ) : null}
      </div>
    </header>
  )
}

const teamsTableUi = {
  table: cn(participantsTableUi.table, 'table-auto'),
  clubTh: cn(participantsTableUi.th, 'min-w-[12rem]'),
  clubTd: cn(participantsTableUi.td, 'min-w-[12rem] whitespace-normal'),
  clubCell: 'grid gap-0.5',
  clubName:
    'text-[0.8125rem] font-semibold leading-snug text-foreground [overflow-wrap:anywhere]',
  clubCity: 'text-xs font-medium leading-snug text-muted [overflow-wrap:anywhere]',
}

const MEDAL_LABELS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
}

function rankMedalLabel(rank: number): string | null {
  return MEDAL_LABELS[rank] ?? null
}

function teamRowClass(rank: number): string {
  if (rank === 1) return 'bg-amber-50/80 hover:bg-amber-50'
  if (rank === 2) return 'bg-slate-50/90 hover:bg-slate-50'
  if (rank === 3) return 'bg-orange-50/70 hover:bg-orange-50'
  return participantsTableUi.rowHover
}

function TeamDisciplineFilter({
  discipline,
  onChange,
}: {
  discipline: TeamRankingDisciplineFilter
  onChange: (value: TeamRankingDisciplineFilter) => void
}) {
  return (
    <>
      <div className={teamsUi.disciplineChips} role="group" aria-label={copy.disciplineLabel}>
        {disciplineOptions.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant="ghost"
            className={cn(
              tournamentPublicUi.chip,
              discipline === option.id && tournamentPublicUi.chipActive,
            )}
            onClick={() => onChange(option.id)}
          >
            {option.shortLabel}
          </Button>
        ))}
      </div>

      <div className={teamsUi.disciplineToggleWrap}>
        <span className={participantsUi.viewLabel}>{copy.disciplineLabel}</span>
        <div className={participantsUi.viewToggle} role="group" aria-label={copy.disciplineLabel}>
          {disciplineOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={cn(
                participantsUi.viewToggleBtn,
                discipline === option.id && participantsUi.viewToggleBtnActive,
              )}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function TeamRankingMobileCard({ row }: { row: TeamRankingRow }) {
  const medal = rankMedalLabel(row.rank)

  return (
    <article className={teamsUi.mobileCard(row.rank)}>
      <div className={participantsCardUi.cardHead}>
        <div className={participantsCardUi.cardHeadMain}>
          <p className={teamsUi.mobileRank}>
            {medal ? <span aria-hidden="true">{medal}</span> : null}
            <span>{copy.placeLabel(row.rank)}</span>
          </p>
          <p className="mt-1 text-base font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
            {row.clubName}
          </p>
          {row.city ? <p className="mt-0.5 text-sm text-muted">{row.city}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className={teamsUi.mobilePointsValue}>{row.points}</p>
          <p className={teamsUi.mobilePointsLabel}>{copy.columns.points}</p>
        </div>
      </div>

      <div className={teamsUi.mobileMedalGrid}>
        {[
          { label: '🥇', value: row.firstPlaces, title: copy.columns.first },
          { label: '🥈', value: row.secondPlaces, title: copy.columns.second },
          { label: '🥉', value: row.thirdPlaces, title: copy.columns.third },
        ].map((item) => (
          <div key={item.title} className={teamsUi.mobileMedalCell} title={item.title}>
            <p className={teamsUi.mobileMedalLabel} aria-hidden="true">{item.label}</p>
            <p className={teamsUi.mobileMedalValue}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className={teamsUi.mobileExtraGrid}>
        <div className={teamsUi.mobileExtraCell}>
          <p className={teamsUi.mobileExtraLabel}>{copy.columns.wins}</p>
          <p className={teamsUi.mobileExtraValue}>{row.wins}</p>
        </div>
        <div className={teamsUi.mobileExtraCell}>
          <p className={teamsUi.mobileExtraLabel}>{copy.columns.fights}</p>
          <p className={teamsUi.mobileExtraValue}>{row.fights}</p>
        </div>
      </div>
    </article>
  )
}

export function TeamsPage() {
  const [data, setData] = useState<TeamRankingsResponse | null>(null)
  const [pageState, setPageState] = useState<TeamsPageState>('loading')
  const [pollingError, setPollingError] = useState(false)
  const [discipline, setDiscipline] = useState<TeamRankingDisciplineFilter>(TEAM_RANKING_DISCIPLINE_ALL)
  const requestSeqRef = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    let pollTimer: number | undefined

    const applyResponse = (result: TeamRankingsResponse, seq: number) => {
      if (cancelled || seq !== requestSeqRef.current) return
      setData(result)
      setPageState('ready')
      setPollingError(false)
    }

    const load = async (isInitial: boolean) => {
      const seq = ++requestSeqRef.current

      try {
        const response = await fetch(
          withBasePath(`/api/tournament/team-rankings?discipline=${encodeURIComponent(discipline)}`),
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        )
        const result = await readPublicApiResponse<TeamRankingsResponse>(response)

        if (cancelled || seq !== requestSeqRef.current) return

        if (result.ok) {
          applyResponse(
            {
              published: Boolean(result.data.published),
              publishedAt: result.data.publishedAt ?? null,
              rankingStatus: result.data.rankingStatus ?? 'in_progress',
              pointSettings: result.data.pointSettings,
              disciplines: result.data.disciplines ?? [],
              activeDiscipline: result.data.activeDiscipline ?? discipline,
              rows: result.data.rows ?? [],
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
  }, [discipline])

  const scoringRuleText = formatTeamRankingTieBreakRule()

  const statsText = useMemo(() => {
    if (!data?.rows.length) return null
    return copy.statsTemplate(pluralClubs(data.rows.length))
  }, [data?.rows.length])

  const statusBanner = useMemo(() => {
    if (!data || data.rankingStatus !== 'complete') return null
    return {
      title: copy.completeBannerTitle,
      description: copy.completeBannerDescription,
    }
  }, [data])

  if (pageState === 'loading') {
    return (
      <div className={cn(tournamentPublicUi.page, 'event-teams-page', tournamentPublicUi.pageStack)}>
        <TeamsHeader publishedAt={null} statsText={null} />
        <div className={cn(teamsUi.panel, teamsUi.emptyPanel)}>
          <p className="text-sm text-muted">{copy.loading}</p>
        </div>
      </div>
    )
  }

  if (pageState === 'disabled') {
    return <TeamsEmptyState title={copy.disabledTitle} description={copy.disabledDescription} />
  }

  if (pageState === 'initial-error') {
    return <TeamsEmptyState title={copy.loadErrorTitle} description={copy.loadErrorDescription} />
  }

  if (!data) {
    return <TeamsEmptyState title={copy.loadErrorTitle} description={copy.loadErrorDescription} />
  }

  if (!data.published) {
    return <TeamsEmptyState title={copy.unpublishedTitle} description={copy.unpublishedDescription} />
  }

  return (
    <div className={cn(tournamentPublicUi.page, 'event-teams-page', tournamentPublicUi.pageStack)}>
      <TeamsHeader publishedAt={data.publishedAt} statsText={statsText} />

      {statusBanner ? (
        <div className="rounded-xl border border-border bg-surface px-3.5 py-3 sm:px-5">
          <p className="text-sm font-semibold text-foreground">{statusBanner.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">
            {statusBanner.description}
          </p>
        </div>
      ) : null}

      {scoringRuleText ? <p className={teamsUi.rulesBox}>{scoringRuleText}</p> : null}

      {pollingError ? (
        <p className="rounded-lg border border-border bg-surface px-3.5 py-2 text-xs text-muted">
          {copy.pollingError}
        </p>
      ) : null}

      <section className={cn(teamsUi.panel, adminPanel)}>
        <div className={participantsUi.toolbarWrap}>
          <TeamDisciplineFilter discipline={discipline} onChange={setDiscipline} />
        </div>

        {data.rows.length === 0 ? (
          <div className={teamsUi.emptyPanel}>
            <p className="text-base font-semibold text-foreground">{copy.emptyTitle}</p>
            <p className="mt-2 text-sm text-muted">{copy.emptyDescription}</p>
          </div>
        ) : (
          <>
            <div className={participantsTableUi.wrap}>
              <table className={teamsTableUi.table}>
                <thead>
                  <tr>
                    <th className={participantsTableUi.th}>{copy.columns.rank}</th>
                    <th className={teamsTableUi.clubTh}>{copy.columns.club}</th>
                    <th className={participantsTableUi.th}>{copy.columns.points}</th>
                    <th className={participantsTableUi.th}>{copy.columns.first}</th>
                    <th className={participantsTableUi.th}>{copy.columns.second}</th>
                    <th className={participantsTableUi.th}>{copy.columns.third}</th>
                    <th className={participantsTableUi.th}>{copy.columns.wins}</th>
                    <th className={participantsTableUi.th}>{copy.columns.fights}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.clubIdentity} className={teamRowClass(row.rank)}>
                      <td className={cn(participantsTableUi.td, 'tabular-nums font-semibold')}>
                        <span className="inline-flex items-center gap-2">
                          {rankMedalLabel(row.rank) ? (
                            <span aria-hidden="true">{rankMedalLabel(row.rank)}</span>
                          ) : null}
                          <span>{row.rank}</span>
                        </span>
                      </td>
                      <td className={teamsTableUi.clubTd}>
                        <div className={teamsTableUi.clubCell}>
                          <span className={teamsTableUi.clubName}>{row.clubName}</span>
                          {row.city ? (
                            <span className={teamsTableUi.clubCity}>{row.city}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className={cn(participantsTableUi.td, 'tabular-nums font-semibold')}>
                        {row.points}
                      </td>
                      <td className={cn(participantsTableUi.td, 'tabular-nums')}>
                        {row.firstPlaces}
                      </td>
                      <td className={cn(participantsTableUi.td, 'tabular-nums')}>
                        {row.secondPlaces}
                      </td>
                      <td className={cn(participantsTableUi.td, 'tabular-nums')}>
                        {row.thirdPlaces}
                      </td>
                      <td className={cn(participantsTableUi.td, 'tabular-nums')}>{row.wins}</td>
                      <td className={cn(participantsTableUi.td, 'tabular-nums')}>{row.fights}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={teamsUi.mobileList}>
              {data.rows.map((row) => (
                <TeamRankingMobileCard key={row.clubIdentity} row={row} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
