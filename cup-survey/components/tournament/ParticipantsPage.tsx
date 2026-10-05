'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Pencil, Search, SlidersHorizontal, Users } from 'lucide-react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { readPublicApiResponse } from '@/lib/tournament/readPublicApiResponse'
import { routes } from '@/lib/routes'
import {
  getDisciplineShortLabel,
  genderOptions,
  tournamentDisciplines,
  tournamentInfo,
} from '@/lib/config/tournament'
import { fseAgeDivisions, formatAgeDivisionFilterLabel } from '@/lib/config/fseCategories'
import { experienceLevelOptions } from '@/lib/config/experienceLevel'
import {
  compareTournamentCategoryGroupKeys,
  getWeightCategoriesForDivision,
} from '@/lib/registration/categoryRules'
import { formatAgeYears, pluralAthletes, pluralCategories, pluralClubs, tournamentPageCopy } from '@/lib/content/tournament-page'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { CollapsePanel } from '@/components/ui/CollapsePanel'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EntryPaymentStatusBadge } from '@/components/ui/EntryPaymentStatusBadge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  disciplineBadgeSm,
  participantsCardUi,
  participantsTableUi,
  participantsUi,
} from './participantsUiClasses'
import { tournamentPublicUi } from './tournamentPublicUiClasses'
import { ParticipantEditUnlockModal } from './ParticipantEditUnlockModal'

interface ParticipantEntry {
  id: string
  discipline: string
  ageDivisionId: string | null
  weightCategoryId: string | null
  experienceLevel: string
  categoryLabel: string
  paymentStatus: string
  paymentStatusLabel: string
}

interface Participant {
  fullName: string
  clubName: string
  city: string
  gender: string
  weight: number | null
  ageYears: number
  disciplines: string[]
  entries: ParticipantEntry[]
  status: string
  hasWeighIn: boolean
}

interface Stats {
  athletes: number
  clubs: number
  tacticControl: number
  closeControl: number
  entries: number
}

interface Filters {
  discipline: string
  gender: string
  club: string
  name: string
  ageDivisionId: string
  weightCategoryId: string
  experienceLevel: string
  paymentStatus: string
  weightMin: string
  weightMax: string
  ageMin: string
  ageMax: string
}

type ViewMode = 'list' | 'categories' | 'clubs'

type FlatRow = Participant & { entry: ParticipantEntry }

interface ParticipantGroup {
  key: string
  title: string
  subtitle?: string
  rows: FlatRow[]
  kind: 'categories' | 'clubs'
}

const emptyFilters: Filters = {
  discipline: '',
  gender: '',
  club: '',
  name: '',
  ageDivisionId: '',
  weightCategoryId: '',
  experienceLevel: '',
  paymentStatus: '',
  weightMin: '',
  weightMax: '',
  ageMin: '',
  ageMax: '',
}

const copy = tournamentPageCopy.participants
const PARTICIPANTS_VIEW_TRANSITION_MS = 280

const genderLabel = (id: string) =>
  genderOptions.find((g) => g.id === id)?.label ?? id


function uniqueAthleteCount(rows: FlatRow[]): number {
  return new Set(rows.map((row) => row.fullName)).size
}

function formatClubWithCity(clubName: string, city: string): string {
  return city ? `${clubName} · ${city}` : clubName
}

function uniqueClubCount(rows: FlatRow[]): number {
  return new Set(rows.map((row) => `${row.clubName}\0${row.city}`)).size
}

function formatGroupCount(group: ParticipantGroup): string {
  const athletes = pluralAthletes(uniqueAthleteCount(group.rows))
  if (group.kind === 'categories') {
    return `${athletes} · ${pluralClubs(uniqueClubCount(group.rows))}`
  }
  return `${athletes} · ${pluralCategories(group.rows.length)}`
}

function buildParticipantGroups(viewMode: ViewMode, rows: FlatRow[]): ParticipantGroup[] | null {
  if (viewMode === 'list') return null

  const groupOrder: string[] = []
  const map = new Map<string, ParticipantGroup>()

  for (const row of rows) {
    const key =
      viewMode === 'categories'
        ? [
            row.entry.discipline,
            row.entry.experienceLevel,
            row.entry.ageDivisionId ?? '',
            row.entry.weightCategoryId ?? '',
          ].join('|')
        : `${row.clubName}\0${row.city}`

    const existing = map.get(key)
    if (existing) {
      existing.rows.push(row)
      continue
    }

    groupOrder.push(key)
    map.set(
      key,
      viewMode === 'categories'
        ? {
            key,
            title: `${getDisciplineShortLabel(row.entry.discipline)} · ${row.entry.categoryLabel}`,
            rows: [row],
            kind: 'categories',
          }
        : {
            key,
            title: formatClubWithCity(row.clubName, row.city),
            rows: [row],
            kind: 'clubs',
          },
    )
  }

  const groups = groupOrder.map((key) => map.get(key)!)

  if (viewMode === 'categories') {
    groups.sort((a, b) => compareTournamentCategoryGroupKeys(a.key, b.key))
  }

  return groups
}

export function ParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [displayViewMode, setDisplayViewMode] = useState<ViewMode>('list')
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [closed, setClosed] = useState(false)
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(() => new Set())
  const [editingRow, setEditingRow] = useState<FlatRow | null>(null)

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  )

  const advancedFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(([key, value]) => key !== 'name' && Boolean(value)).length,
    [filters],
  )

  useEffect(() => {
    fetch(withBasePath('/api/tournament/state'))
      .then((response) => readJsonResponse<{ closed?: boolean }>(response))
      .then((result) => setClosed(result.ok ? Boolean(result.data.closed) : false))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    fetch(withBasePath(`/api/tournament/participants?${params}`))
      .then((response) =>
        readPublicApiResponse<{ participants?: Participant[]; stats?: Stats | null }>(response),
      )
      .then((result) => {
        if (!result.ok) {
          setParticipants([])
          setStats(null)
          return
        }
        setParticipants(result.data.participants ?? [])
        setStats(result.data.stats ?? null)
      })
      .catch(() => {
        setParticipants([])
        setStats(null)
      })
      .finally(() => setLoading(false))
  }, [filters])

  const flatRows = useMemo(
    () =>
      participants.flatMap((participant) =>
        participant.entries.map((entry) => ({
          ...participant,
          entry,
        })),
      ),
    [participants],
  )

  const entries = flatRows.length
  const isEmpty = !loading && participants.length === 0
  const isFilteredEmpty = isEmpty && activeFilterCount > 0
  const isFullyEmpty = isEmpty && activeFilterCount === 0
  const hasListData = !loading && flatRows.length > 0
  const rowGroups = useMemo(
    () => buildParticipantGroups(displayViewMode, flatRows),
    [displayViewMode, flatRows],
  )
  const prevDisplayViewModeRef = useRef(displayViewMode)
  const prevGroupKeysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (viewMode === displayViewMode) return

    if (viewMode === 'list') {
      const currentGroups = buildParticipantGroups(displayViewMode, flatRows)
      if (currentGroups?.length) {
        setCollapsedGroupKeys(new Set(currentGroups.map((group) => group.key)))
        const timer = window.setTimeout(() => {
          setDisplayViewMode('list')
        }, PARTICIPANTS_VIEW_TRANSITION_MS)
        return () => clearTimeout(timer)
      }

      setDisplayViewMode('list')
      return
    }

    setDisplayViewMode(viewMode)
  }, [viewMode, displayViewMode, flatRows])

  useEffect(() => {
    const displayModeChanged = prevDisplayViewModeRef.current !== displayViewMode
    prevDisplayViewModeRef.current = displayViewMode

    if (displayViewMode === 'list') {
      if (displayModeChanged) {
        setCollapsedGroupKeys(new Set())
        prevGroupKeysRef.current = new Set()
      }
      return
    }

    if (!rowGroups?.length) return

    const currentKeySet = new Set(rowGroups.map((group) => group.key))

    if (displayModeChanged) {
      setCollapsedGroupKeys(currentKeySet)
      prevGroupKeysRef.current = currentKeySet
      return
    }

    setCollapsedGroupKeys((prev) => {
      const next = new Set(prev)

      for (const key of currentKeySet) {
        if (!prevGroupKeysRef.current.has(key)) {
          next.add(key)
        }
      }

      for (const key of next) {
        if (!currentKeySet.has(key)) next.delete(key)
      }

      return next
    })
    prevGroupKeysRef.current = currentKeySet
  }, [displayViewMode, rowGroups])

  const toggleGroupCollapsed = (groupKey: string) => {
    setCollapsedGroupKeys((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }

  const patchFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'ageDivisionId' && value !== prev.ageDivisionId) {
        next.weightCategoryId = ''
      }
      if (key === 'gender' && value !== prev.gender) {
        next.ageDivisionId = ''
        next.weightCategoryId = ''
      }
      return next
    })
  }

  const ageDivisionOptions = fseAgeDivisions.filter(
    (division) => !filters.gender || division.gender === filters.gender,
  )
  const weightCategoryOptions = filters.ageDivisionId
    ? getWeightCategoriesForDivision(filters.ageDivisionId)
    : []

  return (
    <div className={cn(tournamentPublicUi.page, tournamentPublicUi.pageStack)}>
      <header className={participantsUi.header}>
        <Link href={withBasePath('/')} className={participantsUi.back}>
          ← К соревнованию
        </Link>
        <h1 className={participantsUi.title}>{copy.title}</h1>
        <p className={participantsUi.description}>{copy.description}</p>
        <div className={participantsUi.meta}>
          <span>{tournamentInfo.eventDateLabel}</span>
          <span className={participantsUi.metaSep} aria-hidden="true">·</span>
          <span>{tournamentInfo.venue.city}</span>
          <span className={participantsUi.metaSep} aria-hidden="true">·</span>
          <div className={participantsUi.metaDisciplines}>
            {tournamentDisciplines.map((d) => (
              <span key={d.id} className={disciplineBadgeSm(d.id)}>
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </header>

      {stats && (
        <div className={participantsUi.statsWrap}>
          <div className={cn(participantsUi.statsPrimary)}>
            <StatCard label={copy.stats.athletes} value={stats.athletes} />
            <StatCard label={copy.stats.clubs} value={stats.clubs} />
            <StatCard label={copy.stats.entries} value={stats.entries} />
          </div>
          <div className={participantsUi.statsDisciplines}>
            <p className={participantsUi.statsHint}>{copy.stats.disciplinesHint}</p>
            <div className={participantsUi.statsDisciplineRow}>
              <DisciplineStatCard discipline="tactic_control" label={copy.stats.tactic} value={stats.tacticControl} />
              <DisciplineStatCard discipline="close_control" label={copy.stats.close} value={stats.closeControl} />
            </div>
          </div>
        </div>
      )}

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
                value={filters.name}
                onChange={(e) => patchFilter('name', e.target.value)}
                aria-label={copy.filters.search}
              />
            </label>

            <div className={participantsUi.controls}>
              <Button
                type="button"
                variant="ghost"
                className={cn(participantsUi.controlBtn, filtersOpen && participantsUi.controlBtnActive)}
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
              >
                <SlidersHorizontal className={participantsUi.controlIcon} strokeWidth={1.75} aria-hidden="true" />
                {filtersOpen ? copy.filters.hide : copy.filters.show}
                {advancedFilterCount > 0 && (
                  <span className={participantsUi.filterBadge}>{advancedFilterCount}</span>
                )}
              </Button>

              <div className={participantsUi.view}>
                <span className={participantsUi.viewLabel}>{copy.viewLabel}</span>
                <div className={participantsUi.viewToggle} role="group" aria-label={copy.viewLabel}>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(participantsUi.viewToggleBtn, viewMode === 'list' && participantsUi.viewToggleBtnActive)}
                    onClick={() => setViewMode('list')}
                  >
                    {copy.filters.viewList}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(participantsUi.viewToggleBtn, viewMode === 'categories' && participantsUi.viewToggleBtnActive)}
                    onClick={() => setViewMode('categories')}
                  >
                    {copy.filters.viewCategories}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(participantsUi.viewToggleBtn, viewMode === 'clubs' && participantsUi.viewToggleBtnActive)}
                    onClick={() => setViewMode('clubs')}
                  >
                    {copy.filters.viewClubs}
                  </Button>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  className={participantsUi.reset}
                  onClick={() => {
                    setFilters(emptyFilters)
                    setFiltersOpen(false)
                  }}
                >
                  {copy.filters.reset}
                </Button>
              )}
            </div>
          </div>

          <div className={cn(filtersOpen ? participantsUi.filtersOpen : participantsUi.filtersClosed, 'event-participants-filters', filtersOpen && 'is-open')}>
            <div className={participantsUi.filtersInner}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <FilterSelect
                  label={copy.columns.disciplines}
                  value={filters.discipline}
                  onChange={(v) => patchFilter('discipline', v)}
                >
                  <option value="">{copy.filters.allDisciplines}</option>
                  {tournamentDisciplines.map((discipline) => (
                    <option key={discipline.id} value={discipline.id}>
                      {discipline.label}
                    </option>
                  ))}
                </FilterSelect>

                <FilterSelect
                  label={copy.columns.gender}
                  value={filters.gender}
                  onChange={(v) => patchFilter('gender', v)}
                >
                  <option value="">{copy.filters.allGenders}</option>
                  {genderOptions.map((g) => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </FilterSelect>

                <FilterInput
                  label={copy.columns.club}
                  placeholder={copy.filters.clubPlaceholder}
                  value={filters.club}
                  onChange={(v) => patchFilter('club', v)}
                />
                <FilterSelect
                  label={copy.filters.experienceLevel}
                  value={filters.experienceLevel}
                  onChange={(v) => patchFilter('experienceLevel', v)}
                >
                  <option value="">{copy.filters.allExperienceLevels}</option>
                  {experienceLevelOptions.map((level) => (
                    <option key={level.id} value={level.id}>{level.label}</option>
                  ))}
                </FilterSelect>
                <FilterSelect
                  label={copy.filters.paymentStatus}
                  value={filters.paymentStatus}
                  onChange={(v) => patchFilter('paymentStatus', v)}
                >
                  <option value="">{copy.filters.allPaymentStatuses}</option>
                  <option value="UNPAID">Не оплачен</option>
                  <option value="PAYMENT_REVIEW">На проверке</option>
                  <option value="PAID">Оплачен</option>
                </FilterSelect>
                <FilterSelect
                  label={copy.filters.ageDivision}
                  value={filters.ageDivisionId}
                  onChange={(v) => patchFilter('ageDivisionId', v)}
                >
                  <option value="">{copy.filters.allAgeDivisions}</option>
                  {ageDivisionOptions.map((division) => (
                    <option key={division.id} value={division.id}>
                      {formatAgeDivisionFilterLabel(division, !filters.gender)}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect
                  label={copy.filters.weightCategory}
                  value={filters.weightCategoryId}
                  onChange={(v) => patchFilter('weightCategoryId', v)}
                >
                  <option value="">{copy.filters.allWeightCategories}</option>
                  {weightCategoryOptions.map((weight) => (
                    <option key={weight.id} value={weight.id}>{weight.label}</option>
                  ))}
                </FilterSelect>
                <FilterInput
                  label={copy.filters.weightMin}
                  inputMode="decimal"
                  value={filters.weightMin}
                  onChange={(v) => patchFilter('weightMin', v)}
                />
                <FilterInput
                  label={copy.filters.weightMax}
                  inputMode="decimal"
                  value={filters.weightMax}
                  onChange={(v) => patchFilter('weightMax', v)}
                />
                <FilterInput
                  label={copy.filters.ageMin}
                  inputMode="numeric"
                  value={filters.ageMin}
                  onChange={(v) => patchFilter('ageMin', v)}
                />
                <FilterInput
                  label={copy.filters.ageMax}
                  inputMode="numeric"
                  value={filters.ageMax}
                  onChange={(v) => patchFilter('ageMax', v)}
                />
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className={participantsUi.loading}>
            <p>Загрузка списка участников…</p>
          </div>
        )}

        {!loading && isFullyEmpty && (
          <EmptyState
            title={copy.emptyTitle}
            description={copy.emptyDescription}
            closed={closed}
            showRegister
          />
        )}

        {!loading && isFilteredEmpty && (
          <EmptyState
            title={copy.emptyFilteredTitle}
            description={copy.emptyFilteredDescription}
            closed={closed}
            onReset={() => {
              setFilters(emptyFilters)
              setFiltersOpen(false)
            }}
          />
        )}

        {!loading && !isEmpty && (
          <div className={participantsUi.summary}>
            {pluralAthletes(participants.length)}, {pluralCategories(entries)}
          </div>
        )}

        {hasListData && (
          <div key={displayViewMode} className={cn(participantsUi.listDisplay, 'event-participants-list-display')}>
            <ParticipantsListDisplay
              rows={flatRows}
              groups={rowGroups}
              collapsedGroupKeys={collapsedGroupKeys}
              onToggleGroup={toggleGroupCollapsed}
              canEdit={!closed}
              onEditRow={setEditingRow}
            />
          </div>
        )}
      </section>

      <ParticipantEditUnlockModal
        open={Boolean(editingRow)}
        athleteName={editingRow?.fullName ?? ''}
        clubName={editingRow?.clubName ?? ''}
        entryId={editingRow?.entry.id ?? null}
        onClose={() => setEditingRow(null)}
      />
    </div>
  )
}

function ParticipantsListDisplay({
  rows,
  groups,
  collapsedGroupKeys,
  onToggleGroup,
  canEdit,
  onEditRow,
}: {
  rows: FlatRow[]
  groups: ParticipantGroup[] | null
  collapsedGroupKeys: Set<string>
  onToggleGroup: (groupKey: string) => void
  canEdit: boolean
  onEditRow: (row: FlatRow) => void
}) {
  if (groups) {
    return (
      <>
        <GroupedParticipantCards
          groups={groups}
          collapsedGroupKeys={collapsedGroupKeys}
          onToggleGroup={onToggleGroup}
          canEdit={canEdit}
          onEditRow={onEditRow}
        />
        <ParticipantTable
          groups={groups}
          collapsedGroupKeys={collapsedGroupKeys}
          onToggleGroup={onToggleGroup}
          canEdit={canEdit}
          onEditRow={onEditRow}
        />
      </>
    )
  }

  return (
    <>
      <ParticipantCards rows={rows} canEdit={canEdit} onEditRow={onEditRow} />
      <ParticipantTable rows={rows} canEdit={canEdit} onEditRow={onEditRow} />
    </>
  )
}

function GroupedParticipantCards({
  groups,
  collapsedGroupKeys,
  onToggleGroup,
  canEdit,
  onEditRow,
}: {
  groups: ParticipantGroup[]
  collapsedGroupKeys: Set<string>
  onToggleGroup: (groupKey: string) => void
  canEdit: boolean
  onEditRow: (row: FlatRow) => void
}) {
  return (
    <div className={participantsCardUi.groupedList}>
      {groups.map((group) => {
        const expanded = !collapsedGroupKeys.has(group.key)
        return (
          <section
            key={group.key}
            className={participantsCardUi.group}
          >
            <ParticipantGroupHead
              group={group}
              expanded={expanded}
              onToggle={() => onToggleGroup(group.key)}
            />
            <div className={participantsCardUi.groupBody}>
              <CollapsePanel open={expanded}>
                <div className={participantsCardUi.groupCards}>
                  <ParticipantCards rows={group.rows} nested canEdit={canEdit} onEditRow={onEditRow} />
                </div>
              </CollapsePanel>
            </div>
          </section>
        )
      })}
    </div>
  )
}

function ParticipantGroupHead({
  group,
  expanded,
  onToggle,
}: {
  group: ParticipantGroup
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(participantsCardUi.groupHead, expanded && participantsCardUi.groupHeadExpanded)}
      aria-expanded={expanded}
      onClick={onToggle}
    >
      <GroupChevron expanded={expanded} />
      <span className={participantsCardUi.groupHeadMain}>
        <span className={participantsCardUi.groupTitle}>{group.title}</span>
        {group.subtitle && (
          <span className={participantsCardUi.groupSubtitle}>{group.subtitle}</span>
        )}
      </span>
      <span className={participantsCardUi.groupCount}>
        {formatGroupCount(group)}
      </span>
    </Button>
  )
}

function GroupChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={cn(participantsCardUi.groupChevron, 'event-participants-group-chevron', expanded && participantsCardUi.groupChevronOpen)}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function ParticipantEditButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={participantsCardUi.editBtn}
      aria-label={copy.edit.label}
      title={copy.edit.label}
      onClick={onClick}
    >
      <Pencil aria-hidden="true" />
    </Button>
  )
}

function ParticipantCards({
  rows,
  nested = false,
  canEdit,
  onEditRow,
}: {
  rows: FlatRow[]
  nested?: boolean
  canEdit: boolean
  onEditRow: (row: FlatRow) => void
}) {
  const cards = rows.map((row) => (
        <article key={row.entry.id} className={participantsCardUi.card}>
          <header className={participantsCardUi.cardHead}>
            <div className={participantsCardUi.cardHeadMain}>
              <p className={cn(participantsCardUi.cardName, 'event-participant-card-name')}>{row.fullName}</p>
              {row.hasWeighIn ? (
                <StatusBadge tone="success" appearance="chip" className="mt-1">
                  Взвешен
                </StatusBadge>
              ) : null}
              <p className={participantsCardUi.cardSub}>{formatClubWithCity(row.clubName, row.city)}</p>
            </div>
            <div className={participantsCardUi.cardActions}>
              <EntryPaymentStatusBadge
                className={participantsCardUi.cardStatus}
                status={row.entry.paymentStatus}
                label={row.entry.paymentStatusLabel}
                publicFacing
              />
              {canEdit && <ParticipantEditButton onClick={() => onEditRow(row)} />}
            </div>
          </header>
          <dl className={participantsCardUi.cardMeta}>
            <div className={participantsCardUi.cardMetaSplit}>
              <div className={participantsCardUi.cardField}>
                <dt className={participantsCardUi.cardFieldLabel}>{copy.columns.gender}</dt>
                <dd className={participantsCardUi.cardFieldValue}>{genderLabel(row.gender)}</dd>
              </div>
              <div className={participantsCardUi.cardField}>
                <dt className={participantsCardUi.cardFieldLabel}>{copy.columns.age}</dt>
                <dd className={participantsCardUi.cardFieldValue}>{formatAgeYears(row.ageYears)}</dd>
              </div>
            </div>
            <div className={participantsCardUi.cardField}>
              <dt className={participantsCardUi.cardFieldLabel}>{copy.columns.category}</dt>
              <dd className={participantsCardUi.cardFieldCategoryValue}>
                <span className={disciplineBadgeSm(row.entry.discipline)}>
                  {getDisciplineShortLabel(row.entry.discipline)}
                </span>
                <span className={participantsCardUi.cardCategory}>{row.entry.categoryLabel}</span>
              </dd>
            </div>
          </dl>
        </article>
      ))

  if (nested) return <>{cards}</>

  return <div className={participantsCardUi.list}>{cards}</div>
}

type TableColumnKey = 'name' | 'club' | 'gender' | 'age' | 'discipline' | 'category' | 'status'

const participantTableColumns: Array<{ key: TableColumnKey; width: string }> = [
  { key: 'name', width: '18%' },
  { key: 'club', width: '16%' },
  { key: 'gender', width: '9%' },
  { key: 'age', width: '7%' },
  { key: 'discipline', width: '11%' },
  { key: 'category', width: '27%' },
  { key: 'status', width: '12%' },
]

function tableColumnLabel(key: TableColumnKey): string {
  switch (key) {
    case 'name':
      return copy.columns.name
    case 'club':
      return copy.columns.club
    case 'gender':
      return copy.columns.gender
    case 'age':
      return copy.columns.age
    case 'discipline':
      return copy.columns.disciplines
    case 'category':
      return copy.columns.category
    case 'status':
      return copy.columns.status
  }
}

function tableColumnClass(key: TableColumnKey): string {
  return participantsTableUi.col[key]
}

function ParticipantTableRow({
  row,
  canEdit,
  onEditRow,
}: {
  row: FlatRow
  canEdit: boolean
  onEditRow: (row: FlatRow) => void
}) {
  const columns = participantTableColumns

  return (
    <tr className={participantsTableUi.rowHover}>
      {columns.map((column) => {
        switch (column.key) {
          case 'name':
            return (
              <td key={column.key} className={cn(participantsTableUi.td, tableColumnClass(column.key))}>
                <div className="flex flex-col gap-1">
                  <span className={cn(participantsTableUi.name, 'event-table-name')}>{row.fullName}</span>
                  {row.hasWeighIn ? (
                    <StatusBadge tone="success" appearance="chip" className="w-fit">
                      Взвешен
                    </StatusBadge>
                  ) : null}
                </div>
              </td>
            )
          case 'club':
            return (
              <td key={column.key} className={cn(participantsTableUi.td, tableColumnClass(column.key))}>
                <div className={participantsTableUi.clubCell} title={formatClubWithCity(row.clubName, row.city)}>
                  <span className={participantsTableUi.clubName}>{row.clubName}</span>
                  {row.city ? <span className={participantsTableUi.clubCity}>{row.city}</span> : null}
                </div>
              </td>
            )
          case 'gender':
            return (
              <td key={column.key} className={cn(participantsTableUi.td, tableColumnClass(column.key))}>
                <span className={participantsTableUi.meta}>{genderLabel(row.gender)}</span>
              </td>
            )
          case 'age':
            return (
              <td key={column.key} className={cn(participantsTableUi.td, tableColumnClass(column.key))}>
                <span className={cn(participantsTableUi.meta, 'tabular-nums')}>{formatAgeYears(row.ageYears)}</span>
              </td>
            )
          case 'discipline':
            return (
              <td key={column.key} className={cn(participantsTableUi.td, tableColumnClass(column.key))}>
                <span className={disciplineBadgeSm(row.entry.discipline)}>
                  {getDisciplineShortLabel(row.entry.discipline)}
                </span>
              </td>
            )
          case 'category':
            return (
              <td key={column.key} className={cn(participantsTableUi.td, tableColumnClass(column.key))}>
                <span className={participantsTableUi.categoryLabel} title={row.entry.categoryLabel}>
                  {row.entry.categoryLabel}
                </span>
              </td>
            )
          case 'status':
            return (
              <td key={column.key} className={cn(participantsTableUi.td, tableColumnClass(column.key))}>
                <div className={participantsTableUi.statusActions}>
                  <EntryPaymentStatusBadge
                    status={row.entry.paymentStatus}
                    label={row.entry.paymentStatusLabel}
                    publicFacing
                  />
                  {canEdit && <ParticipantEditButton onClick={() => onEditRow(row)} />}
                </div>
              </td>
            )
        }
      })}
    </tr>
  )
}

function ParticipantTable({
  rows,
  groups,
  collapsedGroupKeys,
  onToggleGroup,
  canEdit,
  onEditRow,
}: {
  rows?: FlatRow[]
  groups?: ParticipantGroup[]
  collapsedGroupKeys?: Set<string>
  onToggleGroup?: (groupKey: string) => void
  canEdit: boolean
  onEditRow: (row: FlatRow) => void
}) {
  const columns = participantTableColumns
  const columnCount = columns.length

  return (
    <div className={participantsTableUi.wrap}>
      <table className={participantsTableUi.table}>
        <colgroup>
          {columns.map((column) => (
            <col
              key={column.key}
              style={{ width: column.width }}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={cn(participantsTableUi.th, tableColumnClass(column.key))} scope="col">
                {tableColumnLabel(column.key)}
              </th>
            ))}
          </tr>
        </thead>
        {groups ? (
          groups.map((group) => {
            const expanded = !collapsedGroupKeys?.has(group.key)
            return (
              <tbody
                key={group.key}
              >
                <tr>
                  <td
                    colSpan={columnCount}
                    className={cn(
                      participantsTableUi.groupHeadCell,
                      !expanded && participantsTableUi.groupHeadCellCollapsed,
                    )}
                  >
                    <ParticipantGroupHead
                      group={group}
                      expanded={expanded}
                      onToggle={() => onToggleGroup?.(group.key)}
                    />
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={columnCount}
                    className={cn(
                      participantsTableUi.groupBodyCell,
                      !expanded && participantsTableUi.groupBodyCellCollapsed,
                    )}
                  >
                    <CollapsePanel open={expanded}>
                      <table className={participantsTableUi.nested}>
                        <colgroup>
                          {columns.map((column) => (
                            <col
                              key={column.key}
                              style={{ width: column.width }}
                            />
                          ))}
                        </colgroup>
                        <tbody>
                          {group.rows.map((row) => (
                            <ParticipantTableRow
                              key={row.entry.id}
                              row={row}
                              canEdit={canEdit}
                              onEditRow={onEditRow}
                            />
                          ))}
                        </tbody>
                      </table>
                    </CollapsePanel>
                  </td>
                </tr>
              </tbody>
            )
          })
        ) : (
          <tbody>
            {rows?.map((row) => (
              <ParticipantTableRow
                key={row.entry.id}
                row={row}
                canEdit={canEdit}
                onEditRow={onEditRow}
              />
            ))}
          </tbody>
        )}
      </table>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={participantsUi.stat}>
      <p className={participantsUi.statValue}>{value}</p>
      <p className={participantsUi.statLabel}>{label}</p>
    </div>
  )
}

function DisciplineStatCard({
  discipline,
  label,
  value,
}: {
  discipline: string
  label: string
  value: number
}) {
  return (
    <div className={participantsUi.statDiscipline}>
      <span className={disciplineBadgeSm(discipline)}>
        {label}
      </span>
      <p className={participantsUi.statValueDiscipline}>{value}</p>
    </div>
  )
}

function EmptyState({
  title,
  description,
  closed,
  showRegister,
  onReset,
}: {
  title: string
  description: string
  closed: boolean
  showRegister?: boolean
  onReset?: () => void
}) {
  return (
    <div className={participantsUi.empty}>
      <div className={participantsUi.emptyIcon} aria-hidden="true">
        <Users strokeWidth={1.75} />
      </div>
      <h2 className={participantsUi.emptyTitle}>{title}</h2>
      <p className={participantsUi.emptyText}>{description}</p>
      <div className={participantsUi.emptyActions}>
        {showRegister && !closed && (
          <Link href={withBasePath(routes.register)}>
            <Button className="min-h-11 px-6">{copy.registerCta}</Button>
          </Link>
        )}
        {onReset && (
          <Button type="button" variant="secondary" className="min-h-11 px-6" onClick={onReset}>
            {copy.filters.reset}
          </Button>
        )}
        <Link href={withBasePath('/')} className={participantsUi.emptyLink}>
          {copy.backToTournament}
        </Link>
      </div>
    </div>
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
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <Select
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </Select>
  )
}

function FilterInput({
  label,
  placeholder,
  value,
  onChange,
  inputMode,
}: {
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  inputMode?: 'decimal' | 'numeric' | 'text'
}) {
  return (
    <Input
      label={label}
      placeholder={placeholder}
      value={value}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

