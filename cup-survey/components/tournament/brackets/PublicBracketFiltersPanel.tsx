'use client'

import { useMemo } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { genderOptions, tournamentDisciplines } from '@/lib/config/tournament'
import { fseAgeDivisions, formatAgeDivisionFilterLabel } from '@/lib/config/fseCategories'
import { experienceLevelOptions } from '@/lib/config/experienceLevel'
import { getWeightCategoriesForDivision } from '@/lib/registration/categoryRules'
import { parseRegistrationCategoryKey } from '@/lib/registration/categoryIdentity'
import { tournamentPageCopy, pluralCategories, pluralMedalists } from '@/lib/content/tournament-page'
import {
  countActiveBracketFilters,
  emptyBracketCategoryFilters,
  type BracketCategoryFilterItem,
  type BracketCategoryFilters,
} from '@/lib/brackets/publicCategoryFilters'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { participantsUi } from '@/components/tournament/participantsUiClasses'
import { tournamentPublicUi } from '@/components/tournament/tournamentPublicUiClasses'

const copy = tournamentPageCopy.participants.filters

interface PublicBracketFiltersPanelProps {
  categories: BracketCategoryFilterItem[]
  filters: BracketCategoryFilters
  filtersOpen: boolean
  searchQuery: string
  filteredCount: number
  searchPlaceholder?: string
  /** How to phrase the active-filter summary line. Defaults to category count. */
  filteredCountMode?: 'categories' | 'medalists'
  completionToolbar?: React.ReactNode
  onFiltersOpenChange: (open: boolean) => void
  onFiltersChange: (filters: BracketCategoryFilters) => void
  onSearchQueryChange: (value: string) => void
}

function patchBracketFilters(
  filters: BracketCategoryFilters,
  key: keyof BracketCategoryFilters,
  value: string,
): BracketCategoryFilters {
  const next = { ...filters, [key]: value }
  if (key === 'ageDivisionId' && value !== filters.ageDivisionId) {
    next.weightCategoryId = ''
  }
  if (key === 'gender' && value !== filters.gender) {
    next.ageDivisionId = ''
    next.weightCategoryId = ''
  }
  return next
}

export function PublicBracketFiltersPanel({
  categories,
  filters,
  filtersOpen,
  searchQuery,
  filteredCount,
  searchPlaceholder = 'Фамилия, имя, клуб или категория',
  filteredCountMode = 'categories',
  completionToolbar,
  onFiltersOpenChange,
  onFiltersChange,
  onSearchQueryChange,
}: PublicBracketFiltersPanelProps) {
  const activeFilterCount = countActiveBracketFilters(filters)
  const trimmedSearch = searchQuery.trim()
  const hasActiveSearch = trimmedSearch.length > 0

  const presentDisciplines = useMemo(() => {
    const ids = new Set(categories.map((category) => category.discipline))
    return tournamentDisciplines.filter((discipline) => ids.has(discipline.id))
  }, [categories])

  const presentExperienceLevels = useMemo(() => {
    const ids = new Set(
      categories
        .map((category) => parseRegistrationCategoryKey(category.categoryKey)?.experienceLevel)
        .filter(Boolean),
    )
    return experienceLevelOptions.filter((level) => ids.has(level.id))
  }, [categories])

  const presentAgeDivisionIds = useMemo(() => {
    const ids = new Set(
      categories
        .map((category) => parseRegistrationCategoryKey(category.categoryKey)?.ageDivisionId)
        .filter(Boolean),
    )
    return fseAgeDivisions.filter((division) => ids.has(division.id))
  }, [categories])

  const ageDivisionOptions = presentAgeDivisionIds.filter(
    (division) => !filters.gender || division.gender === filters.gender,
  )

  const presentWeightIds = useMemo(() => {
    const ids = new Set(
      categories
        .map((category) => parseRegistrationCategoryKey(category.categoryKey)?.weightCategoryId)
        .filter(Boolean),
    )
    return ids
  }, [categories])

  const weightCategoryOptions = filters.ageDivisionId
    ? getWeightCategoriesForDivision(filters.ageDivisionId).filter((weight) =>
        presentWeightIds.has(weight.id),
      )
    : [...presentWeightIds]
        .map((weightId) => {
          for (const division of presentAgeDivisionIds) {
            const match = getWeightCategoriesForDivision(division.id).find(
              (weight) => weight.id === weightId,
            )
            if (match) return match
          }
          return null
        })
        .filter((weight): weight is NonNullable<typeof weight> => weight !== null)
        .sort((a, b) => a.label.localeCompare(b.label, 'ru'))

  const patchFilter = (key: keyof BracketCategoryFilters, value: string) => {
    onFiltersChange(patchBracketFilters(filters, key, value))
  }

  const filteredCountLabel =
    filteredCountMode === 'medalists'
      ? pluralMedalists(filteredCount)
      : pluralCategories(filteredCount)

  return (
    <section
      className={cn(
        'public-brackets-filters overflow-hidden p-0 print:hidden',
        tournamentPublicUi.card,
        participantsUi.panel,
      )}
    >
      {completionToolbar ? (
        <div className={tournamentPublicUi.embeddedFilterRow}>{completionToolbar}</div>
      ) : null}

      <div className={participantsUi.toolbarWrap}>
        <div className={participantsUi.toolbar}>
          <label className={participantsUi.search}>
            <span className="sr-only">{copy.search}</span>
            <Search className={participantsUi.searchIcon} strokeWidth={1.75} aria-hidden="true" />
            <Input
              controlOnly
              className={participantsUi.searchInput}
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              aria-label={copy.search}
            />
          </label>

          <div className={participantsUi.controls}>
            <Button
              type="button"
              variant="ghost"
              className={cn(participantsUi.controlBtn, filtersOpen && participantsUi.controlBtnActive)}
              onClick={() => onFiltersOpenChange(!filtersOpen)}
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal
                className={participantsUi.controlIcon}
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {filtersOpen ? copy.hide : copy.show}
              {activeFilterCount > 0 && (
                <span className={participantsUi.filterBadge}>{activeFilterCount}</span>
              )}
            </Button>

            {(activeFilterCount > 0 || hasActiveSearch) && (
              <Button
                type="button"
                variant="ghost"
                className={participantsUi.reset}
                onClick={() => {
                  onFiltersChange(emptyBracketCategoryFilters)
                  onSearchQueryChange('')
                  onFiltersOpenChange(false)
                }}
              >
                {copy.reset}
              </Button>
            )}
          </div>
        </div>

        <div
          className={cn(
            'event-participants-filters',
            filtersOpen ? 'is-open mt-3.5 border-t border-border' : 'hidden',
          )}
        >
          <div className={participantsUi.filtersInner}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
              <FilterSelect
                label={tournamentPageCopy.participants.columns.disciplines}
                value={filters.discipline}
                onChange={(value) => patchFilter('discipline', value)}
              >
                <option value="">{copy.allDisciplines}</option>
                {presentDisciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id}>
                    {discipline.label}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label={tournamentPageCopy.participants.columns.gender}
                value={filters.gender}
                onChange={(value) => patchFilter('gender', value)}
              >
                <option value="">{copy.allGenders}</option>
                {genderOptions.map((gender) => (
                  <option key={gender.id} value={gender.id}>
                    {gender.label}
                  </option>
                ))}
              </FilterSelect>

              <FilterInput
                label={tournamentPageCopy.participants.columns.club}
                placeholder={copy.clubPlaceholder}
                value={filters.club}
                onChange={(value) => patchFilter('club', value)}
              />

              <FilterSelect
                label={copy.experienceLevel}
                value={filters.experienceLevel}
                onChange={(value) => patchFilter('experienceLevel', value)}
              >
                <option value="">{copy.allExperienceLevels}</option>
                {presentExperienceLevels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.label}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label={copy.ageDivision}
                value={filters.ageDivisionId}
                onChange={(value) => patchFilter('ageDivisionId', value)}
              >
                <option value="">{copy.allAgeDivisions}</option>
                {ageDivisionOptions.map((division) => (
                  <option key={division.id} value={division.id}>
                    {formatAgeDivisionFilterLabel(division, !filters.gender)}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label={copy.weightCategory}
                value={filters.weightCategoryId}
                onChange={(value) => patchFilter('weightCategoryId', value)}
              >
                <option value="">{copy.allWeightCategories}</option>
                {weightCategoryOptions.map((weight) => (
                  <option key={weight.id} value={weight.id}>
                    {weight.label}
                  </option>
                ))}
              </FilterSelect>
            </div>
          </div>
        </div>
      </div>

      {(hasActiveSearch || activeFilterCount > 0) && (
        <div className={participantsUi.summary}>
          Показано {filteredCountLabel}
          {hasActiveSearch ? ` · «${trimmedSearch}»` : ''}
        </div>
      )}
    </section>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <Select label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {children}
    </Select>
  )
}

function FilterInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Input
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
