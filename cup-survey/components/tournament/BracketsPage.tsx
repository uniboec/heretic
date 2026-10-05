'use client'

import { cn } from '@/lib/cn'
import { adminPanel, adminPanelHeader } from '@/lib/ui/adminSurfaceStyles'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { withBasePath } from '@/lib/basePath'
import { formatPublicBracketCategoryMeta } from '@/lib/brackets/labels'
import {
  countBracketCategoriesByCompletion,
  emptyBracketCategoryFilters,
  matchesBracketCategoryFilters,
  matchesBracketCompletionMode,
  sortBracketCategories,
  type BracketCategoryFilters,
  type PublicBracketCompletionMode,
} from '@/lib/brackets/publicCategoryFilters'
import { pluralCategories, tournamentPageCopy } from '@/lib/content/tournament-page'
import { defaultPublicCompletionMode } from '@/lib/tournament/publicCompletionDefaults'
import { readPublicApiResponse } from '@/lib/tournament/readPublicApiResponse'
import { participantsUi } from '@/components/tournament/participantsUiClasses'
import { tournamentPublicUi } from '@/components/tournament/tournamentPublicUiClasses'
import { BracketSystemRenderer } from './brackets/BracketSystemRenderer'
import { PublicBracketCompletionSwitch } from './brackets/PublicBracketCompletionSwitch'
import { PublicBracketFiltersPanel } from './brackets/PublicBracketFiltersPanel'
import {
  PublicBracketCategorySidebar,
  type PublicBracketCategory,
} from './brackets/PublicBracketCategorySidebar'
import type { BracketStructure, CategoryResult } from '@/lib/brackets/core/types'

interface PublicCategory extends PublicBracketCategory {
  bronzeMode: 'ONE' | 'TWO' | null
  participants: Array<{
    entryId: string
    seedPosition: number
    displayName: string
    clubName: string
    city: string
  }>
  structure: BracketStructure | null
  result?: CategoryResult | null
}

interface BracketsResponse {
  published: boolean
  publishedAt: string | null
  categories: PublicCategory[]
}

function BracketsEmptyState({
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
        <h1 className={participantsUi.titleCompact}>Сетки</h1>
        <p className={participantsUi.descriptionCompact}>{description}</p>
      </header>
      <div className={`${adminPanel} p-10 text-center`}>
        <p className="text-base font-semibold text-foreground">{title}</p>
      </div>
    </div>
  )
}

export function BracketsPage() {
  const [data, setData] = useState<BracketsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [categoryQuery, setCategoryQuery] = useState('')
  const [filters, setFilters] = useState<BracketCategoryFilters>(emptyBracketCategoryFilters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [completionModeOverride, setCompletionModeOverride] =
    useState<PublicBracketCompletionMode | null>(null)
  const [scheduleDisplayByBoutId, setScheduleDisplayByBoutId] = useState<Map<string, string>>(
    () => new Map(),
  )
  const [releasedCategoryKeys, setReleasedCategoryKeys] = useState<Set<string>>(() => new Set())

  const bracketsCopy = tournamentPageCopy.brackets

  useEffect(() => {
    Promise.all([
      fetch(withBasePath('/api/tournament/brackets')),
      fetch(withBasePath('/api/tournament/bouts')),
    ])
      .then(async ([bracketsResponse, boutsResponse]) => {
        const result = await readPublicApiResponse<BracketsResponse>(bracketsResponse)
        const boutsResult = await readPublicApiResponse<{
          published?: boolean
          mats?: Array<{ bouts: Array<{ id: string; scheduleDisplayNumber: string; categoryKey: string }> }>
        }>(boutsResponse)

        if (boutsResult.ok && boutsResult.data?.published) {
          const displayMap = new Map<string, string>()
          const releasedKeys = new Set<string>()
          for (const mat of boutsResult.data.mats ?? []) {
            for (const bout of mat.bouts) {
              displayMap.set(bout.id, bout.scheduleDisplayNumber)
              releasedKeys.add(bout.categoryKey)
            }
          }
          setScheduleDisplayByBoutId(displayMap)
          setReleasedCategoryKeys(releasedKeys)
        } else {
          setScheduleDisplayByBoutId(new Map())
          setReleasedCategoryKeys(new Set())
        }

        if (result.ok) {
          const normalized: BracketsResponse = {
            published: Boolean(result.data.published),
            publishedAt: result.data.publishedAt ?? null,
            categories: result.data.categories ?? [],
          }
          setData(normalized)
          return
        }
        if (result.kind === 'error') {
          setLoadError(true)
        }
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [])

  const sortedCategories = useMemo(
    () => (data?.categories?.length ? sortBracketCategories(data.categories) : []),
    [data],
  )

  const completionCounts = useMemo(
    () => countBracketCategoriesByCompletion(sortedCategories),
    [sortedCategories],
  )

  const completionMode =
    completionModeOverride ?? defaultPublicCompletionMode(completionCounts)

  const completionFilteredCategories = useMemo(() => {
    if (!sortedCategories.length) return []
    return sortedCategories.filter((category) =>
      matchesBracketCompletionMode(category, completionMode),
    )
  }, [sortedCategories, completionMode])

  const filteredCategories = useMemo(() => {
    if (!completionFilteredCategories.length) return []
    return completionFilteredCategories.filter((category) =>
      matchesBracketCategoryFilters(category, filters, categoryQuery),
    )
  }, [completionFilteredCategories, filters, categoryQuery])

  useEffect(() => {
    if (!filteredCategories.length) {
      setSelectedKey(null)
      return
    }
    if (!selectedKey || !filteredCategories.some((category) => category.categoryKey === selectedKey)) {
      setSelectedKey(filteredCategories[0].categoryKey)
    }
  }, [filteredCategories, selectedKey])

  if (loading) {
    return (
      <div className={cn(tournamentPublicUi.page, 'event-brackets-page', tournamentPublicUi.pageStack)}>
        <header className={participantsUi.header}>
          <h1 className={participantsUi.titleCompact}>Сетки</h1>
          <p className={participantsUi.descriptionCompact}>Турнирные сетки по категориям</p>
        </header>
        <div className={`${adminPanel} p-10 text-center`}>
          <p className="text-sm text-muted">Загрузка сеток…</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <BracketsEmptyState
        title="Не удалось загрузить сетки"
        description="Попробуйте обновить страницу. Если ошибка повторяется — сообщите организаторам."
      />
    )
  }

  if (!data) {
    return (
      <BracketsEmptyState
        title="Раздел недоступен"
        description="Публичная страница сеток отключена организаторами турнира."
      />
    )
  }

  if (!data.published || !data.categories?.length) {
    return (
      <BracketsEmptyState
        title="Сетки скоро появятся"
        description="Организаторы ещё не опубликовали сетки на сайте. Загляните позже."
      />
    )
  }

  const selected =
    filteredCategories.find((category) => category.categoryKey === selectedKey) ??
    filteredCategories[0] ??
    null

  return (
    <div className={cn(tournamentPublicUi.page, 'event-brackets-page', tournamentPublicUi.pageStack)}>
      <header className={participantsUi.header}>
        <Link href={withBasePath('/')} className={participantsUi.back}>
          ← К соревнованию
        </Link>
        <div className="min-w-0">
          <h1 className={participantsUi.titleCompact}>Сетки</h1>
          <p className={participantsUi.descriptionCompact}>
            Турнирные сетки по категориям · {pluralCategories(data.categories.length)}
          </p>
          {data.publishedAt && (
            <p className="mt-1.5 hidden text-xs text-muted sm:block">
              Опубликовано {new Date(data.publishedAt).toLocaleString('ru-RU')}
            </p>
          )}
        </div>
      </header>

      <PublicBracketFiltersPanel
        categories={sortedCategories}
        filters={filters}
        filtersOpen={filtersOpen}
        searchQuery={categoryQuery}
        filteredCount={filteredCategories.length}
        completionToolbar={
          <PublicBracketCompletionSwitch
            mode={completionMode}
            counts={completionCounts}
            onChange={setCompletionModeOverride}
          />
        }
        onFiltersOpenChange={setFiltersOpen}
        onFiltersChange={setFilters}
        onSearchQueryChange={setCategoryQuery}
      />

      <div className={tournamentPublicUi.bracketsGrid}>
        <PublicBracketCategorySidebar
          categories={filteredCategories}
          selectedKey={selected?.categoryKey ?? null}
          showCompletionBadge={completionMode === 'all'}
          onSelectCategory={setSelectedKey}
        />

        <section className={cn(tournamentPublicUi.bracketsMain, adminPanel)}>
          {filteredCategories.length === 0 ? (
            <div className="flex min-h-[24rem] flex-col items-center justify-center p-6 text-center">
              <p className="text-base font-semibold text-foreground">
                {completionFilteredCategories.length === 0
                  ? completionMode === 'active'
                    ? bracketsCopy.emptyActiveTitle
                    : completionMode === 'completed'
                      ? bracketsCopy.emptyCompletedTitle
                      : 'Нет категорий по фильтрам'
                  : 'Нет категорий по фильтрам'}
              </p>
              <p className="mt-2 text-sm text-muted">
                {completionFilteredCategories.length === 0
                  ? completionMode === 'active'
                    ? bracketsCopy.emptyActiveDescription
                    : completionMode === 'completed'
                      ? bracketsCopy.emptyCompletedDescription
                      : 'Измените фильтры или поиск по участнику, клубу или категории.'
                  : 'Измените фильтры или поиск по участнику, клубу или категории.'}
              </p>
            </div>
          ) : selected ? (
            <>
              <div className={cn(adminPanelHeader, tournamentPublicUi.bracketsPanelHeader)}>
                <h2 className={tournamentPublicUi.bracketsPanelTitle}>{selected.title}</h2>
                <p className="mt-1 text-xs font-normal text-muted">
                  {formatPublicBracketCategoryMeta(
                    selected.participants.length,
                    selected.systemId,
                  )}
                </p>
              </div>
              <div className="bracket-system-canvas p-3">
                <BracketSystemRenderer
                  systemId={selected.systemId}
                  structure={selected.structure}
                  participants={selected.participants}
                  result={selected.result}
                  categoryKey={selected.categoryKey}
                  boutsReleased={releasedCategoryKeys.has(selected.categoryKey)}
                  scheduleDisplayByBoutId={scheduleDisplayByBoutId}
                />
              </div>
            </>
          ) : (
            <div className="flex min-h-[24rem] items-center justify-center p-6 text-sm text-muted">
              Выберите категорию выше
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
