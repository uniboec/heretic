'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { LayoutGrid } from 'lucide-react'
import { withBasePath } from '@/lib/basePath'
import { routes } from '@/lib/routes'
import { buildSchedulePositionSortedList } from '@/lib/bouts/buildScheduleList'
import {
  countPublicBoutsByCompletion,
  matchesPublicBoutCompletionMode,
  type PublicBoutCompletionMode,
} from '@/lib/bouts/publicBoutCompletion'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import { defaultPublicCompletionMode } from '@/lib/tournament/publicCompletionDefaults'
import { readPublicApiResponse } from '@/lib/tournament/readPublicApiResponse'
import { type BoutCardData } from '@/components/tournament/BoutCard'
import { cn } from '@/lib/cn'
import { participantsUi } from '@/components/tournament/participantsUiClasses'
import { tournamentPublicUi } from '@/components/tournament/tournamentPublicUiClasses'
import {
  BoutsScheduleSection,
  type BoutsMatFilter,
} from '@/components/tournament/BoutsScheduleSection'
import type { StageTimingSummary } from '@/lib/bouts/scheduleTypes'

interface PublicBoutSide {
  kind: 'athlete' | 'hint' | 'bye'
  entryId?: string
  displayName?: string
  clubName?: string
  label?: string
}

interface PublicBout extends BoutCardData {
  categoryKey: string
  discipline: string
  winnerEntryId?: string | null
  sideA: PublicBoutSide
  sideB: PublicBoutSide
}

interface BoutsResponse {
  published: boolean
  publishedAt: string | null
  generatedAt?: string
  matCount: number
  mats: Array<{
    matIndex: number
    configuredStartTime?: string
    estimatedEndAt?: string | null
    bouts: PublicBout[]
  }>
  stageSummaries?: StageTimingSummary[]
}

function boutSearchHaystack(bout: PublicBout): string {
  return [
    bout.categoryTitle,
    bout.label,
    bout.sideA.displayName,
    bout.sideA.clubName,
    bout.sideA.label,
    bout.sideB.displayName,
    bout.sideB.clubName,
    bout.sideB.label,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function BoutsEmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className={tournamentPublicUi.page}>
      <header className={participantsUi.header}>
        <Link href={withBasePath('/')} className={participantsUi.back}>
          ← К соревнованию
        </Link>
        <h1 className={participantsUi.title}>Поединки</h1>
        <p className={participantsUi.description}>{description}</p>
      </header>
      <div className={cn(tournamentPublicUi.card, tournamentPublicUi.emptyCard)}>
        <p className="text-base font-semibold text-[var(--color-foreground)]">{title}</p>
      </div>
    </div>
  )
}

export function BoutsPage() {
  const [data, setData] = useState<BoutsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [matFilter, setMatFilter] = useState<BoutsMatFilter>('all')
  const [completionModeOverride, setCompletionModeOverride] =
    useState<PublicBoutCompletionMode | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const boutsCopy = tournamentPageCopy.bouts
  const [snapshotAnchor, setSnapshotAnchor] = useState<{
    generatedAt: string
    receivedAt: number
  } | null>(null)
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch(withBasePath('/api/tournament/bouts'), { cache: 'no-store' })
        const result = await readPublicApiResponse<BoutsResponse>(response)
        if (cancelled) return
        if (result.ok) {
          setData(result.data)
          if (result.data.generatedAt) {
            setSnapshotAnchor({
              generatedAt: result.data.generatedAt,
              receivedAt: Date.now(),
            })
          }
          return
        }
        if (result.kind === 'error') {
          setLoadError(true)
        }
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const timer = window.setInterval(() => {
      void load()
    }, 45_000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const referenceNow = useMemo(() => {
    if (!snapshotAnchor) return new Date()
    const generatedAtMs = new Date(snapshotAnchor.generatedAt).getTime()
    const elapsedMs = Date.now() - snapshotAnchor.receivedAt
    return new Date(generatedAtMs + elapsedMs)
  }, [snapshotAnchor])

  const mats = data?.mats ?? []

  const allBouts = useMemo(() => buildSchedulePositionSortedList(mats), [mats])

  const completionCounts = useMemo(
    () => countPublicBoutsByCompletion(allBouts),
    [allBouts],
  )

  const completionMode =
    completionModeOverride ?? defaultPublicCompletionMode(completionCounts)

  const scheduleBouts = useMemo(
    () => allBouts.filter((bout) => matchesPublicBoutCompletionMode(bout, completionMode)),
    [allBouts, completionMode],
  )

  const visibleBouts = useMemo(() => {
    if (matFilter === 'all') return scheduleBouts
    return scheduleBouts.filter((bout) => bout.matIndex === matFilter)
  }, [matFilter, scheduleBouts])

  const filteredBouts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return visibleBouts
    return visibleBouts.filter((bout) => boutSearchHaystack(bout).includes(query))
  }, [searchQuery, visibleBouts])

  const totalBoutCount = useMemo(
    () => mats.reduce((sum, mat) => sum + mat.bouts.length, 0),
    [mats],
  )

  if (loading) {
    return (
      <div className={cn(tournamentPublicUi.page, 'event-bouts-page', tournamentPublicUi.pageStack)}>
        <header className={participantsUi.header}>
          <Link href={withBasePath('/')} className={participantsUi.back}>
            ← К соревнованию
          </Link>
          <h1 className={participantsUi.title}>Поединки</h1>
          <p className={participantsUi.description}>Расписание боёв по коврам</p>
        </header>
        <div className={cn(tournamentPublicUi.card, tournamentPublicUi.boutsPanel)}>
          <p className={participantsUi.loading}>Загрузка поединков…</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <BoutsEmptyState
        title="Не удалось загрузить поединки"
        description="Попробуйте обновить страницу. Если ошибка повторяется — сообщите организаторам."
      />
    )
  }

  if (!data?.published) {
    return (
      <BoutsEmptyState
        title="Поединки скоро появятся"
        description="Организаторы ещё не опубликовали расписание на сайте. Загляните позже."
      />
    )
  }

  return (
    <div className={cn(tournamentPublicUi.page, 'event-bouts-page', tournamentPublicUi.pageStack)}>
      <header className={participantsUi.header}>
        <Link href={withBasePath('/')} className={participantsUi.back}>
          ← К соревнованию
        </Link>
        <div className={cn(tournamentPublicUi.headerRow, tournamentPublicUi.headerRowBoutsMobile)}>
          <div className="min-w-0">
            <h1 className={participantsUi.title}>Поединки</h1>
            <p className={participantsUi.description}>Расписание боёв по коврам</p>
            {data.publishedAt && (
              <p className="mt-1.5 text-xs text-muted">
                Опубликовано {new Date(data.publishedAt).toLocaleString('ru-RU')}
              </p>
            )}
          </div>
          <Link
            href={withBasePath(routes.brackets)}
            className={cn(tournamentPublicUi.printBtn, tournamentPublicUi.printBtnFullWidth)}
          >
            <LayoutGrid className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Сетки
          </Link>
        </div>
      </header>

      <BoutsScheduleSection
        mats={mats}
        matCount={data.matCount}
        totalBoutCount={totalBoutCount}
        scheduleBouts={scheduleBouts}
        completionMode={completionMode}
        completionCounts={completionCounts}
        onCompletionModeChange={setCompletionModeOverride}
        matFilter={matFilter}
        onMatFilterChange={setMatFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        visibleBouts={visibleBouts}
        filteredBouts={filteredBouts}
        emptyVisibleTitle={
          completionMode === 'active'
            ? matFilter === 'all'
              ? boutsCopy.emptyActiveTitle
              : `На ковре ${matFilter} нет актуальных поединков`
            : completionMode === 'completed'
              ? matFilter === 'all'
                ? boutsCopy.emptyCompletedTitle
                : `На ковре ${matFilter} нет завершённых поединков`
              : matFilter === 'all'
                ? 'Поединков пока нет'
                : `На ковре ${matFilter} пока нет поединков`
        }
        emptyVisibleDescription={
          completionMode === 'active'
            ? boutsCopy.emptyActiveDescription
            : completionMode === 'completed'
              ? boutsCopy.emptyCompletedDescription
              : 'Когда организаторы опубликуют сетки, расписание появится здесь.'
        }
        referenceNow={referenceNow}
        stageSummaries={data.stageSummaries ?? []}
      />
    </div>
  )
}
