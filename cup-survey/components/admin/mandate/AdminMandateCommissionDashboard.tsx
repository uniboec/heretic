'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import type {
  MandateCommissionKpi,
  MandateCommissionListFilters,
  MandateCommissionRow,
  MandatePatchInput,
} from '@/lib/mandate/types'
import { aggregateStatusLabels } from '@/lib/mandate/labels'
import { cn } from '@/lib/cn'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminStatCard } from '@/components/admin/AdminStatCard'
import { AdminSelect } from '@/components/admin/AdminSelect'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { AdminMandateCommentButton } from './AdminMandateCommentButton'
import { AdminMandateTriStateControl } from './AdminMandateTriStateControl'
import { AdminMandateWeightCell } from './AdminMandateWeightCell'
import { isDebtEntryStatus } from '@/lib/registration/status'
import { useMandatePatchQueue } from './useMandatePatchQueue'
import {
  adminAthletesTableWrap,
  adminCardField,
  adminCardFieldLabel,
  adminCardFieldValue,
  adminCardFields,
  adminCards,
  adminPanel,
  adminPanelHeader,
  adminRowCard,
  adminSettingsAlert,
  adminSettingsAlertError,
  adminTableDesktop,
} from '@/lib/ui/adminSurfaceStyles'

type DashboardPayload = {
  rows: MandateCommissionRow[]
  kpi: MandateCommissionKpi
}

const checkStatusOptions = [
  { value: '', label: 'Все статусы' },
  { value: 'all_ok', label: aggregateStatusLabels.all_ok },
  { value: 'has_issues', label: aggregateStatusLabels.has_issues },
  { value: 'not_checked', label: aggregateStatusLabels.not_checked },
]

function aggregateBadgeTone(
  status: MandateCommissionRow['aggregateStatus'],
): 'success' | 'warning' | 'neutral' {
  if (status === 'all_ok') return 'success'
  if (status === 'has_issues') return 'warning'
  return 'neutral'
}

function athleteHasDebt(row: MandateCommissionRow): boolean {
  return row.bracketEntries.some((entry) => isDebtEntryStatus(entry.paymentStatus))
}

function collectCategoryOptions(rows: MandateCommissionRow[]): Map<string, string> {
  const keys = new Map<string, string>()
  for (const row of rows) {
    for (const entry of row.bracketEntries) {
      keys.set(entry.categoryKey, entry.categoryLabel)
    }
  }
  return keys
}

export function AdminMandateCommissionDashboard({
  initialData,
  initialAthleteId = '',
}: {
  initialData: DashboardPayload
  initialAthleteId?: string
}) {
  const [rows, setRows] = useState(initialData.rows)
  const [kpi, setKpi] = useState(initialData.kpi)
  const [search, setSearch] = useState('')
  const [categoryKey, setCategoryKey] = useState('')
  const [checkStatus, setCheckStatus] = useState('')
  const [athleteId, setAthleteId] = useState(initialAthleteId)
  const [loading, setLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const searchTimerRef = useRef<number | null>(null)
  const [categoryCatalog, setCategoryCatalog] = useState(() =>
    collectCategoryOptions(initialData.rows),
  )

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'Все категории' },
      ...[...categoryCatalog.entries()]
        .sort((a, b) => a[1].localeCompare(b[1], 'ru'))
        .map(([value, label]) => ({ value, label })),
    ],
    [categoryCatalog],
  )

  const hasActiveFilters = Boolean(search.trim() || categoryKey || checkStatus || athleteId)

  const loadRows = useCallback(async (filters: MandateCommissionListFilters) => {
    setLoading(true)
    setSaveError(null)
    const params = new URLSearchParams()
    if (filters.q) params.set('q', filters.q)
    if (filters.categoryKey) params.set('categoryKey', filters.categoryKey)
    if (filters.checkStatus) params.set('checkStatus', filters.checkStatus)
    if (filters.athleteId) params.set('athleteId', filters.athleteId)

    try {
      const response = await fetch(withBasePath(`/api/admin/mandate-commission?${params}`))
      const result = await readJsonResponse<DashboardPayload>(response)
      if (result.ok) {
        setCategoryCatalog((current) => {
          const next = new Map(current)
          for (const [key, label] of collectCategoryOptions(result.data.rows)) {
            next.set(key, label)
          }
          return next
        })
        setRows(result.data.rows)
        setKpi(result.data.kpi)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
    searchTimerRef.current = window.setTimeout(() => {
      void loadRows({
        q: search || undefined,
        categoryKey: categoryKey || undefined,
        checkStatus: (checkStatus || undefined) as MandateCommissionListFilters['checkStatus'],
        athleteId: athleteId || undefined,
      })
    }, 300)
    return () => {
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
    }
  }, [search, categoryKey, checkStatus, athleteId, loadRows])

  const { enqueuePatch } = useMandatePatchQueue(
    (athleteId, result) => {
      setRows((current) =>
        current.map((row) =>
          row.athleteId === athleteId
            ? {
                ...row,
                check: result.check as MandateCommissionRow['check'],
                weightStatus: result.weightStatus as MandateCommissionRow['weightStatus'],
                aggregateStatus: result.aggregateStatus as MandateCommissionRow['aggregateStatus'],
                issueCount: result.issueCount,
              }
            : row,
        ),
      )
    },
    () => setSaveError('Не удалось сохранить изменения'),
  )

  const patchRow = useCallback(
    (athleteId: string, patch: MandatePatchInput) => {
      setSaveError(null)
      enqueuePatch(athleteId, patch)
    },
    [enqueuePatch],
  )

  const resetFilters = () => {
    setSearch('')
    setCategoryKey('')
    setCheckStatus('')
    setAthleteId('')
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Допуск"
        description="Допуск спортсменов: документы, медсправка, страховка и взвешивание по опубликованным сеткам."
      />

      <section className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <AdminStatCard label="Всего" value={String(kpi.total)} />
        <AdminStatCard label="Допуск OK" value={String(kpi.allOk)} />
        <AdminStatCard label="Замечания" value={String(kpi.hasIssues)} />
        <AdminStatCard label="Не проверен" value={String(kpi.notChecked)} />
        <AdminStatCard label="Не взвешены" value={String(kpi.notWeighedIn)} />
      </section>

      {saveError ? (
        <p className={cn(adminSettingsAlert, adminSettingsAlertError, 'mx-1')}>{saveError}</p>
      ) : null}

      {athleteId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3">
          <p className="text-sm text-foreground">
            Показан один спортсмен для допуска с ковра.
            {rows[0] ? ` ${rows[0].fullName}` : ''}
          </p>
          <Button type="button" variant="ghost" className="text-xs" onClick={resetFilters}>
            Показать всех
          </Button>
        </div>
      ) : null}

      <section className={adminPanel}>
        <div className={adminPanelHeader}>Допуск спортсменов ({rows.length})</div>

        <div className="space-y-3 border-b border-border px-3 py-3">
          <label className="flex w-full items-center gap-2">
            <span className="sr-only">Поиск</span>
            <Input
              controlOnly
              density="compact"
              className="w-full"
              placeholder="Имя, клуб или город"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <AdminSelect
              label="Категория"
              value={categoryKey}
              onChange={(event) => setCategoryKey(event.target.value)}
            >
              {categoryOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AdminSelect>
            <AdminSelect
              label="Статус допуска"
              value={checkStatus}
              onChange={(event) => setCheckStatus(event.target.value)}
            >
              {checkStatusOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AdminSelect>
          </div>

          {(hasActiveFilters || loading) && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {loading ? <span className="text-xs text-muted">Обновление…</span> : null}
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-9 px-3 py-1.5 text-xs"
                  onClick={resetFilters}
                >
                  Сбросить фильтры
                </Button>
              ) : null}
            </div>
          )}
        </div>

        <div className={cn(adminCards, 'gap-3.5')}>
          {loading && rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">Загрузка…</p>
          ) : null}
          {rows.map((row) => (
            <article key={row.athleteId} className={cn(adminRowCard, 'flex flex-col gap-0 p-3.5')}>
              <MandateAthleteControls row={row} onPatch={patchRow} />
            </article>
          ))}
          {!loading && rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">
              Спортсмены из опубликованных сеток не найдены.
            </p>
          ) : null}
        </div>

        <div
          className={cn(
            adminTableDesktop,
            adminAthletesTableWrap,
            'mandate-commission-table [&_table]:text-[0.8125rem] [&_td]:px-2 [&_td]:py-2 [&_th]:px-2 [&_th]:py-2 [&_th]:text-[0.6875rem]',
          )}
        >
          <Table>
            <thead>
              <tr>
                <th>Спортсмен</th>
                <th>Документы</th>
                <th>Медсправка</th>
                <th>Страховка</th>
                <th>Вес</th>
                <th className="w-10 text-center">
                  <span className="sr-only">Комментарий</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.athleteId}>
                  <td className="min-w-[10rem] max-w-[14rem]">
                    <AthleteSummary row={row} compact />
                  </td>
                  <td>
                    <AdminMandateTriStateControl
                      value={row.check?.documentsStatus ?? 'UNCHECKED'}
                      onChange={(value) => patchRow(row.athleteId, { documentsStatus: value })}
                    />
                  </td>
                  <td>
                    <AdminMandateTriStateControl
                      value={row.check?.medicalStatus ?? 'UNCHECKED'}
                      onChange={(value) => patchRow(row.athleteId, { medicalStatus: value })}
                    />
                  </td>
                  <td>
                    <AdminMandateTriStateControl
                      value={row.check?.insuranceStatus ?? 'UNCHECKED'}
                      onChange={(value) => patchRow(row.athleteId, { insuranceStatus: value })}
                    />
                  </td>
                  <td className="min-w-[10.5rem]">
                    <WeightControls row={row} onPatch={patchRow} compact />
                  </td>
                  <td className="text-center">
                    <AdminMandateCommentButton
                      athleteName={row.fullName}
                      value={row.check?.comment ?? ''}
                      onSave={(comment) => patchRow(row.athleteId, { comment })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {loading && rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Загрузка…</p>
          ) : null}
          {!loading && rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              Спортсмены из опубликованных сеток не найдены.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function AthleteSummary({
  row,
  compact = false,
}: {
  row: MandateCommissionRow
  compact?: boolean
}) {
  const hasDebt = athleteHasDebt(row)

  return (
    <div className="space-y-1">
      <p className="font-semibold leading-snug text-foreground">
        {row.fullName}
        {hasDebt ? <span className="ml-1.5 font-medium text-danger">· Долг</span> : null}
      </p>
      <p className="text-[11px] leading-snug text-muted">
        {row.clubName}
        {row.city ? ` · ${row.city}` : ''}
      </p>
      <StatusBadge tone={aggregateBadgeTone(row.aggregateStatus)} appearance="chip">
        {aggregateStatusLabels[row.aggregateStatus]}
        {row.issueCount > 0 ? ` (${row.issueCount})` : ''}
      </StatusBadge>
      {compact ? (
        <p className="truncate text-[11px] leading-snug text-muted" title={row.bracketEntries.map((e) => e.categoryLabel).join(' · ')}>
          {row.bracketEntries.map((entry) => entry.categoryLabel).join(' · ')}
        </p>
      ) : (
        <ul className="space-y-0.5 text-xs leading-snug text-muted">
          {row.bracketEntries.map((entry) => (
            <li key={entry.entryId}>{entry.categoryLabel}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function WeightControls({
  row,
  onPatch,
  compact = false,
}: {
  row: MandateCommissionRow
  onPatch: (athleteId: string, patch: MandatePatchInput) => void
  compact?: boolean
}) {
  return (
    <AdminMandateWeightCell
      compact={compact}
      weightStatus={row.weightStatus}
      actualWeightKg={row.check?.actualWeightKg ?? null}
      manualWeightVerified={row.check?.manualWeightVerified ?? false}
      weightCheckMode={row.check?.weightCheckMode ?? null}
      onWeightChange={(value) => onPatch(row.athleteId, { actualWeightKg: value })}
      onManualVerify={(verified) => onPatch(row.athleteId, { manualWeightVerified: verified })}
      onManualIssue={() => onPatch(row.athleteId, { manualWeightIssue: true })}
      onReset={() => onPatch(row.athleteId, { resetWeightCheck: true })}
    />
  )
}

function MandateAthleteControls({
  row,
  onPatch,
}: {
  row: MandateCommissionRow
  onPatch: (athleteId: string, patch: MandatePatchInput) => void
}) {
  return (
    <div className="space-y-0">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-base font-semibold leading-snug text-foreground">
            {row.fullName}
            {athleteHasDebt(row) ? (
              <span className="ml-1.5 font-medium text-danger">· Долг</span>
            ) : null}
          </p>
          <p className="mt-1 text-xs leading-snug text-muted">
            {row.clubName}
            {row.city ? ` · ${row.city}` : ''}
          </p>
        </div>
        <StatusBadge tone={aggregateBadgeTone(row.aggregateStatus)} appearance="chip">
          {aggregateStatusLabels[row.aggregateStatus]}
          {row.issueCount > 0 ? ` (${row.issueCount})` : ''}
        </StatusBadge>
      </header>

      <dl className={adminCardFields}>
        <div className={adminCardField}>
          <dt className={adminCardFieldLabel}>Категории</dt>
          <dd className={adminCardFieldValue}>
            <ul className="space-y-0.5">
              {row.bracketEntries.map((entry) => (
                <li key={entry.entryId}>{entry.categoryLabel}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div className={adminCardField}>
          <dt className={adminCardFieldLabel}>Документы</dt>
          <dd className={adminCardFieldValue}>
            <AdminMandateTriStateControl
              value={row.check?.documentsStatus ?? 'UNCHECKED'}
              onChange={(value) => onPatch(row.athleteId, { documentsStatus: value })}
            />
          </dd>
        </div>
        <div className={adminCardField}>
          <dt className={adminCardFieldLabel}>Медсправка</dt>
          <dd className={adminCardFieldValue}>
            <AdminMandateTriStateControl
              value={row.check?.medicalStatus ?? 'UNCHECKED'}
              onChange={(value) => onPatch(row.athleteId, { medicalStatus: value })}
            />
          </dd>
        </div>
        <div className={adminCardField}>
          <dt className={adminCardFieldLabel}>Страховка</dt>
          <dd className={adminCardFieldValue}>
            <AdminMandateTriStateControl
              value={row.check?.insuranceStatus ?? 'UNCHECKED'}
              onChange={(value) => onPatch(row.athleteId, { insuranceStatus: value })}
            />
          </dd>
        </div>
        <div className={adminCardField}>
          <dt className={adminCardFieldLabel}>Вес</dt>
          <dd className={adminCardFieldValue}>
            <WeightControls row={row} onPatch={onPatch} />
          </dd>
        </div>
        <div className={adminCardField}>
          <dt className={adminCardFieldLabel}>Комментарий</dt>
          <dd className={adminCardFieldValue}>
            <AdminMandateCommentButton
              athleteName={row.fullName}
              value={row.check?.comment ?? ''}
              onSave={(comment) => onPatch(row.athleteId, { comment })}
            />
            {row.check?.comment ? (
              <p className="mt-2 text-xs leading-snug text-muted">{row.check.comment}</p>
            ) : null}
          </dd>
        </div>
      </dl>
    </div>
  )
}
