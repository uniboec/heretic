'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { experienceLevelOptions } from '@/lib/config/experienceLevel'
import { genderOptions, tournamentDisciplines } from '@/lib/config/tournament'
import { formatMoney } from '@/lib/formatMoney'
import { formatAthleteFullName } from '@/lib/registration/athleteName'
import {
  getEntryPaymentStatusLabel,
  type EntryPaymentStatus,
  type RegistrationStatus,
} from '@/lib/registration/status'
import type { AdminAthleteListRow } from '@/lib/registration/adminAthletesList'
import { Button } from '@/components/ui/Button'
import { Table } from '@/components/ui/Table'
import { Input } from '@/components/ui/Input'
import { AdminSelect } from './AdminSelect'
import { AdminPageHeader } from './AdminPageHeader'
import { AdminStatCard } from './AdminStatCard'
import { AdminAthleteEditModal, type AdminAthleteDetail } from './AdminAthleteEditModal'
import { AdminConfirmEntryPaymentModal } from './AdminConfirmEntryPaymentModal'
import { AdminMarkEntryDebtModal } from './AdminMarkEntryDebtModal'
import { AdminEntryPaymentActions } from './AdminEntryPaymentActions'
import { AdminPaymentProofModal, type AdminPaymentProofDetail } from './AdminPaymentProofModal'
import { RegistrationStatusBadge } from './RegistrationStatusBadge'
import { AdminRegistrationImpactDialog } from './AdminRegistrationImpactDialog'
import { useRegistrationImpactFlow } from './useRegistrationImpactFlow'
import {
  fingerprintAthleteDelete,
  fingerprintAthleteUpdate,
  fingerprintConfirmPayment,
  fingerprintEntryPaymentStatus,
  fingerprintMarkDebt,
  fingerprintStandaloneForceRebuild,
  collectCategoryKeysFromAthletePayload,
} from '@/lib/registration/adminImpact'
import { BRACKET_IMPACT_CONFIRM } from '@/lib/brackets/labels'
import { cn } from '@/lib/cn'
import {
  adminAthletesTableWrap,
  adminCards,
  adminCompactActionBtn,
  adminCompactDangerBtn,
  adminPageActionsBtn,
  adminPanel,
  adminPanelHeader,
  adminRowCard,
  adminTableDesktop,
} from '@/lib/ui/adminSurfaceStyles'

interface AdminAthletesDashboardProps {
  initialRows?: AdminAthleteListRow[]
}

type AthleteFilters = {
  gender: string
  discipline: string
  paymentStatus: string
  registrationStatus: string
  experienceLevel: string
}

const emptyFilters: AthleteFilters = {
  gender: '',
  discipline: '',
  paymentStatus: '',
  registrationStatus: '',
  experienceLevel: '',
}

const registrationStatusOptions: Array<{ value: RegistrationStatus; label: string }> = [
  { value: 'AWAITING_PAYMENT', label: 'Ожидает оплаты' },
  { value: 'PAYMENT_REVIEW', label: 'На проверке' },
  { value: 'PAID', label: 'Оплачено' },
  { value: 'PAYMENT_REJECTED', label: 'Отклонено' },
  { value: 'SUBMITTED', label: 'Отправлено' },
  { value: 'CANCELLED', label: 'Отменено' },
]

function genderLabel(id: string): string {
  return genderOptions.find((option) => option.id === id)?.label ?? id
}

function formatBirthDate(value: string): string {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}.${month}.${year}`
}

function toAthleteDetail(row: AdminAthleteListRow): AdminAthleteDetail {
  return {
    id: row.id,
    lastName: row.lastName,
    firstName: row.firstName,
    middleName: row.middleName,
    birthDate: row.birthDate,
    gender: row.gender,
    rank: row.rank,
    entries: row.entries.map((entry) => ({
      id: entry.id,
      discipline: entry.discipline,
      ageDivisionId: entry.ageDivisionId,
      weightCategoryId: entry.weightCategoryId,
      experienceLevel: entry.experienceLevel,
      price: entry.price,
      paymentStatus: entry.paymentStatus,
      paymentStatusLabel: entry.paymentStatusLabel,
    })),
  }
}

function canViewApprovedReceipt(entry: AdminAthleteListRow['entries'][number]): boolean {
  return (
    entry.paymentStatus === 'PAID' &&
    entry.paymentProofId != null &&
    entry.paymentProofStatus === 'approved'
  )
}

function hasActiveFilters(filters: AthleteFilters, search: string): boolean {
  return Boolean(
    search.trim() ||
      filters.gender ||
      filters.discipline ||
      filters.paymentStatus ||
      filters.registrationStatus ||
      filters.experienceLevel,
  )
}

function patchEntryDebtInRows(
  rows: AdminAthleteListRow[],
  update: {
    entryId: string
    price: number
    paymentStageId: string
    paymentStageLabel: string
  },
  paymentStatusFilter: string,
): AdminAthleteListRow[] {
  return rows
    .map((row) => ({
      ...row,
      entries: row.entries.map((entry) =>
        entry.id === update.entryId
          ? {
              ...entry,
              paymentStatus: 'DEBT',
              paymentStatusLabel: `Долг · ${update.paymentStageLabel}`,
              price: update.price,
              paymentStage: update.paymentStageId,
            }
          : entry,
      ),
    }))
    .filter((row) => {
      if (!paymentStatusFilter || row.entries.length === 0) return true
      return row.entries.some((entry) => entry.paymentStatus === paymentStatusFilter)
    })
}

function patchEntryPaidInRows(
  rows: AdminAthleteListRow[],
  update: {
    entryId: string
    price: number
    paymentStageId: string
    paidAt: string
  },
  paymentStatusFilter: string,
): AdminAthleteListRow[] {
  return rows
    .map((row) => ({
      ...row,
      entries: row.entries.map((entry) =>
        entry.id === update.entryId
          ? {
              ...entry,
              paymentStatus: 'PAID',
              paymentStatusLabel: getEntryPaymentStatusLabel('PAID'),
              price: update.price,
              paymentStage: update.paymentStageId,
              paidAt: update.paidAt,
            }
          : entry,
      ),
    }))
    .filter((row) => {
      if (!paymentStatusFilter || row.entries.length === 0) return true
      return row.entries.some((entry) => entry.paymentStatus === paymentStatusFilter)
    })
}

export function AdminAthletesDashboard({ initialRows = [] }: AdminAthletesDashboardProps) {
  const { confirm, loading: impactLoading, setConfirm, runWithImpact, confirmImpact } =
    useRegistrationImpactFlow()
  const [rows, setRows] = useState<AdminAthleteListRow[]>(initialRows)
  const [loading, setLoading] = useState(initialRows.length === 0)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<AthleteFilters>(emptyFilters)
  const [editingAthlete, setEditingAthlete] = useState<AdminAthleteListRow | null>(null)
  const [updatingEntryId, setUpdatingEntryId] = useState<string | null>(null)
  const [viewingProof, setViewingProof] = useState<{
    registrationId: string
    proof: AdminPaymentProofDetail
  } | null>(null)
  const [loadingProofId, setLoadingProofId] = useState<string | null>(null)
  const [confirmingEntryId, setConfirmingEntryId] = useState<string | null>(null)
  const [confirmPresetStageId, setConfirmPresetStageId] = useState<string | null>(null)
  const [markingDebtEntryId, setMarkingDebtEntryId] = useState<string | null>(null)
  const [creatingAthleteOpen, setCreatingAthleteOpen] = useState(false)
  const skipInitialLoadingRef = useRef(initialRows.length > 0)

  const load = useCallback(async () => {
    setLoadError('')
    if (!skipInitialLoadingRef.current) {
    setLoading(true)
    }
    skipInitialLoadingRef.current = false
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (filters.gender) params.set('gender', filters.gender)
      if (filters.discipline) params.set('discipline', filters.discipline)
      if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus)
      if (filters.registrationStatus) params.set('registrationStatus', filters.registrationStatus)
      if (filters.experienceLevel) params.set('experienceLevel', filters.experienceLevel)

      const query = params.toString()
      const res = await fetch(
        withBasePath(`/api/admin/registrations/athletes${query ? `?${query}` : ''}`),
      )
      if (res.status === 401) {
        setRows([])
        setLoadError('Сессия админки истекла. Обновите страницу и войдите снова.')
        return
      }
      const result = await readJsonResponse<{ athletes?: AdminAthleteListRow[] }>(res)
      if (!result.ok) {
        setRows([])
        setLoadError(result.error || 'Не удалось загрузить список спортсменов.')
        return
      }
      setRows(result.data.athletes ?? [])
    } catch {
      setRows([])
      setLoadError('Не удалось загрузить список спортсменов.')
    } finally {
      setLoading(false)
    }
  }, [filters, search])

  const reloadListPreservingScroll = useCallback(async () => {
    const scrollY = window.scrollY
    await load()
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY)
    })
  }, [load])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, search ? 250 : 0)

    return () => window.clearTimeout(timer)
  }, [load, search])

  const totalEntries = useMemo(
    () => rows.reduce((sum, row) => sum + row.entryCount, 0),
    [rows],
  )

  const patchFilter = (key: keyof AthleteFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const resetFilters = () => {
    setSearch('')
    setFilters(emptyFilters)
  }

  const findRegistrationIdForEntry = (entryId: string): string | null => {
    for (const row of rows) {
      if (row.entries.some((entry) => entry.id === entryId)) {
        return row.registration.id
      }
    }
    return null
  }

  const updateEntryStatus = async (entryId: string, paymentStatus: string) => {
    const registrationId = findRegistrationIdForEntry(entryId)
    if (!registrationId) return

    const previousRows = rows
    let previousStatus = 'UNPAID'
    for (const row of rows) {
      const entry = row.entries.find((item) => item.id === entryId)
      if (entry) {
        previousStatus = entry.paymentStatus
        break
      }
    }
    const statusLabel = getEntryPaymentStatusLabel(paymentStatus as EntryPaymentStatus)

    setRows((current) =>
      current
        .map((row) => ({
          ...row,
          entries: row.entries.map((entry) =>
            entry.id === entryId
              ? { ...entry, paymentStatus, paymentStatusLabel: statusLabel }
              : entry,
          ),
        }))
        .filter((row) => {
          if (!filters.paymentStatus || row.entries.length === 0) return true
          return row.entries.some((entry) => entry.paymentStatus === filters.paymentStatus)
        }),
    )

    setUpdatingEntryId(entryId)
    try {
      const ok = await runWithImpact({
        registrationId,
        mutationFingerprint: fingerprintEntryPaymentStatus({
          entryId,
          paymentStatus,
          previousStatus,
        }),
        entryIds: [entryId],
        title: BRACKET_IMPACT_CONFIRM.registrationTitle,
        body: BRACKET_IMPACT_CONFIRM.registrationBody,
        execute: (impactToken) =>
          fetch(withBasePath(`/api/admin/registrations/entries/${entryId}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentStatus, ...(impactToken ? { impactToken } : {}) }),
        }),
      })
      if (!ok) {
        setRows(previousRows)
      } else {
        await reloadListPreservingScroll()
      }
    } finally {
      setUpdatingEntryId(null)
    }
  }

  const openPaidConfirm = (entryId: string, presetStageId?: string | null) => {
    setConfirmPresetStageId(presetStageId ?? null)
    setConfirmingEntryId(entryId)
  }

  const openDebtConfirm = (entryId: string) => {
    setMarkingDebtEntryId(entryId)
  }

  const viewReceipt = async (registrationId: string, proofId: string) => {
    setLoadingProofId(proofId)
    try {
      const result = await readJsonResponse<{ paymentProofs?: AdminPaymentProofDetail[] }>(
        await fetch(withBasePath(`/api/admin/registrations/${registrationId}`)),
      )
      if (!result.ok) {
        window.alert(result.error)
        return
      }
      const proof = result.data.paymentProofs?.find((item) => item.id === proofId)
      if (!proof) {
        window.alert('Квитанция не найдена.')
        return
      }
      setViewingProof({ registrationId, proof })
    } finally {
      setLoadingProofId(null)
    }
  }

  const deleteAthlete = async (row: AdminAthleteListRow) => {
    const name = formatAthleteFullName({
      lastName: row.lastName,
      firstName: row.firstName,
      middleName: row.middleName,
    })
    if (!window.confirm(`Удалить спортсмена ${name}?`)) return

    const ok = await runWithImpact({
      registrationId: row.registration.id,
      mutationFingerprint: fingerprintAthleteDelete(row.id, row.registration.id),
      entryIds: row.entries.map((entry) => entry.id),
      title: BRACKET_IMPACT_CONFIRM.registrationTitle,
      body: BRACKET_IMPACT_CONFIRM.registrationBody,
      execute: (impactToken) =>
        fetch(withBasePath(`/api/admin/registrations/athletes/${row.id}`), {
        method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(impactToken ? { impactToken } : {}),
        }),
    })

    if (!ok) return

    if (editingAthlete?.id === row.id) {
      setEditingAthlete(null)
    }
    await load()
  }

  const submitAthleteEdit = async (
    payload: {
      lastName: string
      firstName: string
      middleName?: string
      birthDate: string
      gender: string
      rank: string
      disciplineEntries: Array<{
        discipline: string
        ageDivisionId: string
        weightCategoryId: string
        experienceLevel: string
      }>
    },
    context: { mode: 'edit'; athleteId: string; registrationId: string; entryIds: string[] },
  ): Promise<{ ok: boolean; errors?: string[] }> => {
    const categoryKeys = collectCategoryKeysFromAthletePayload({
      gender: payload.gender,
      disciplineEntries: payload.disciplineEntries,
    })
    const mutationFingerprint = fingerprintAthleteUpdate(
      context.athleteId,
      context.registrationId,
      payload,
    )

    const ok = await runWithImpact({
      registrationId: context.registrationId,
      mutationFingerprint,
      categoryKeys,
      entryIds: context.entryIds,
      title: BRACKET_IMPACT_CONFIRM.registrationTitle,
      body: BRACKET_IMPACT_CONFIRM.registrationBody,
      execute: async (impactToken) => {
        return fetch(withBasePath(`/api/admin/registrations/athletes/${context.athleteId}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, ...(impactToken ? { impactToken } : {}) }),
        })
      },
    })

    if (!ok) {
      return { ok: false, errors: ['Операция отменена или не выполнена.'] }
    }
    return { ok: true }
  }

  const submitStandaloneAthleteCreate = async (payload: {
    lastName: string
    firstName: string
    middleName?: string
    birthDate: string
    gender: string
    rank: string
    clubName?: string
    city?: string
    phone?: string
    disciplineEntries: Array<{
      discipline: string
      ageDivisionId: string
      weightCategoryId: string
      experienceLevel: string
    }>
  }): Promise<{ ok: boolean; errors?: string[] }> => {
    const categoryKeys = collectCategoryKeysFromAthletePayload({
      gender: payload.gender,
      disciplineEntries: payload.disciplineEntries,
    })

    const ok = await runWithImpact({
      impactOperation: 'standalone_force_rebuild',
      categoryKeys,
      mutationFingerprint: fingerprintStandaloneForceRebuild(categoryKeys),
      title: BRACKET_IMPACT_CONFIRM.registrationTitle,
      body: BRACKET_IMPACT_CONFIRM.registrationBody,
      execute: async (impactToken) => {
        return fetch(withBasePath('/api/admin/registrations/athletes/standalone'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, ...(impactToken ? { impactToken } : {}) }),
        })
      },
    })

    if (!ok) {
      return { ok: false, errors: ['Операция отменена или не выполнена.'] }
    }
    return { ok: true }
  }

  const handleConfirmPayment = async (input: {
    entryId: string
    paymentStageId: string
    paidAt: string
    comment: string
    withoutProof: boolean
    impactToken?: string
  }) => {
    const registrationId = findRegistrationIdForEntry(input.entryId)
    if (!registrationId) {
      return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404 })
    }

    let lastResponse: Response | null = null
    const execute = async (impactToken?: string) => {
      lastResponse = await fetch(
        withBasePath(`/api/admin/registrations/entries/${input.entryId}/confirm-payment`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentStageId: input.paymentStageId,
            paidAt: input.paidAt,
            comment: input.comment,
            withoutProof: input.withoutProof,
            ...(impactToken ? { impactToken } : {}),
          }),
        },
      )
      return lastResponse
    }

    if (input.impactToken) {
      return execute(input.impactToken)
    }

    const ok = await runWithImpact({
      registrationId,
      mutationFingerprint: fingerprintConfirmPayment({
        entryId: input.entryId,
        paymentStageId: input.paymentStageId,
      }),
      entryIds: [input.entryId],
      title: BRACKET_IMPACT_CONFIRM.registrationTitle,
      body: BRACKET_IMPACT_CONFIRM.registrationBody,
      execute,
    })

    return lastResponse ?? new Response(JSON.stringify({ error: ok ? 'UNKNOWN' : 'CANCELLED' }), {
      status: ok ? 500 : 409,
    })
  }

  const handleMarkDebt = async (input: {
    entryId: string
    paymentStageId: string
    impactToken?: string
  }) => {
    const registrationId = findRegistrationIdForEntry(input.entryId)
    if (!registrationId) {
      return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404 })
    }

    let lastResponse: Response | null = null
    const execute = async (impactToken?: string) => {
      lastResponse = await fetch(
        withBasePath(`/api/admin/registrations/entries/${input.entryId}/mark-debt`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentStageId: input.paymentStageId,
            ...(impactToken ? { impactToken } : {}),
          }),
        },
      )
      return lastResponse
    }

    if (input.impactToken) {
      return execute(input.impactToken)
    }

    const ok = await runWithImpact({
      registrationId,
      mutationFingerprint: fingerprintMarkDebt({
        entryId: input.entryId,
        paymentStageId: input.paymentStageId,
      }),
      entryIds: [input.entryId],
      title: BRACKET_IMPACT_CONFIRM.registrationTitle,
      body: BRACKET_IMPACT_CONFIRM.registrationBody,
      execute,
    })

    return lastResponse ?? new Response(JSON.stringify({ error: ok ? 'UNKNOWN' : 'CANCELLED' }), {
      status: ok ? 500 : 409,
    })
  }

  const openAddAthleteForm = () => {
    setCreatingAthleteOpen(true)
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Спортсмены"
        description="Список всех зарегистрированных спортсменов. Статус оплаты по категориям можно менять прямо в списке."
        actions={
          <Button type="button" className={adminPageActionsBtn} onClick={openAddAthleteForm}>
            Добавить спортсмена
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2">
        <AdminStatCard label="Спортсменов" value={loading ? '…' : String(rows.length)} />
        <AdminStatCard label="Категорий" value={loading ? '…' : String(totalEntries)} />
      </section>

      {loadError && (
        <p className="mx-1 rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger-foreground">{loadError}</p>
      )}

      <section className={adminPanel}>
        <div className={adminPanelHeader}>Спортсмены ({rows.length})</div>

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

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <AdminSelect
              label="Пол"
              value={filters.gender}
              onChange={(event) => patchFilter('gender', event.target.value)}
            >
              <option value="">Все</option>
              {genderOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </AdminSelect>

            <AdminSelect
              label="Дисциплина"
              value={filters.discipline}
              onChange={(event) => patchFilter('discipline', event.target.value)}
            >
              <option value="">Все</option>
              {tournamentDisciplines.map((discipline) => (
                <option key={discipline.id} value={discipline.id}>{discipline.label}</option>
              ))}
            </AdminSelect>

            <AdminSelect
              label="Статус оплаты"
              value={filters.paymentStatus}
              onChange={(event) => patchFilter('paymentStatus', event.target.value)}
            >
              <option value="">Все</option>
              <option value="UNPAID">Не оплачен</option>
              <option value="PAYMENT_REVIEW">На проверке</option>
              <option value="PAID">Оплачен</option>
              <option value="ADMITTED_WITHOUT_PAYMENT">Допущен без оплаты</option>
              <option value="DEBT">Долг</option>
            </AdminSelect>

            <AdminSelect
              label="Статус заявки"
              value={filters.registrationStatus}
              onChange={(event) => patchFilter('registrationStatus', event.target.value)}
            >
              <option value="">Все</option>
              {registrationStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </AdminSelect>

            <AdminSelect
              label="Уровень"
              value={filters.experienceLevel}
              onChange={(event) => patchFilter('experienceLevel', event.target.value)}
            >
              <option value="">Все</option>
              {experienceLevelOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </AdminSelect>
          </div>

          {hasActiveFilters(filters, search) && (
            <div className="flex justify-end">
              <Button type="button" variant="ghost" className="min-h-9 px-3 py-1.5 text-xs" onClick={resetFilters}>
                Сбросить фильтры
              </Button>
            </div>
          )}
        </div>

        <div className={cn(adminCards, 'gap-3.5')}>
          {loading && rows.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted">Загрузка…</p>
          )}
          {rows.map((row) => {
            const name = formatAthleteFullName({
              lastName: row.lastName,
              firstName: row.firstName,
              middleName: row.middleName,
            })
            return (
              <article key={row.id} className={cn(adminRowCard, 'flex flex-col gap-0 p-3.5')}>
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-[1_1_auto]">
                    <p className="m-0 text-base font-semibold leading-snug text-foreground">{name}</p>
                    <p className="mt-1 text-xs leading-snug text-muted">
                      {formatBirthDate(row.birthDate)} · {genderLabel(row.gender)}
                    </p>
                  </div>
                  <RegistrationStatusBadge status={row.registration.status} />
                </header>

                <dl className="mt-3 grid gap-2.5 border-t border-border/90 pt-3">
                  <div className="flex flex-col gap-1">
                    <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">Клуб</dt>
                    <dd className="m-0 text-sm font-medium leading-snug text-foreground">{row.registration.clubName}</dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">Заявка</dt>
                    <dd className="m-0 text-sm font-medium leading-snug text-foreground">
                      №{row.registration.publicNumber} · {row.registration.city}
                      {row.entryCount > 0 && ` · ${row.entryCount} кат.`}
                    </dd>
                  </div>
                </dl>

                {row.entries.length > 0 ? (
                  <ul className="mt-3 list-none border-t border-border/90 p-0">
                    {row.entries.map((entry) => (
                      <li key={entry.id} className="border-b border-border/70 py-3 last:border-b-0 last:pb-0">
                        <div className="mb-2.5 flex items-start justify-between gap-3">
                          <p className="m-0 min-w-0 flex-[1_1_auto] text-sm leading-snug text-foreground">{entry.categoryLabel}</p>
                          <p className="m-0 shrink-0 whitespace-nowrap text-sm font-semibold text-accent">
                            {formatMoney(entry.price, { plus: false })}
                          </p>
                        </div>
                        <div className="flex flex-col items-stretch gap-1.5">
                          <AdminEntryPaymentActions
                            entry={entry}
                            disabled={updatingEntryId === entry.id}
                            selectOnly
                            onUpdate={(entryId, paymentStatus) => void updateEntryStatus(entryId, paymentStatus)}
                            onRequestPaidConfirm={openPaidConfirm}
                            onRequestDebtConfirm={openDebtConfirm}
                          />
                          {canViewApprovedReceipt(entry) && entry.paymentProofId && (
                            <Button
                              type="button"
                              variant="ghost"
                              className={adminCompactActionBtn}
                              onClick={() => void viewReceipt(row.registration.id, entry.paymentProofId!)}
                              disabled={loadingProofId === entry.paymentProofId}
                            >
                              {loadingProofId === entry.paymentProofId ? 'Загрузка…' : 'Чек'}
                            </Button>
                          )}
                        </div>
                        {updatingEntryId === entry.id && (
                          <p className="mt-1.5 text-[0.6875rem] text-muted">Сохранение…</p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 border-t border-border/90 pt-3 text-sm text-muted">Категории не указаны</p>
                )}

                <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-border/90 pt-3.5">
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(adminCompactActionBtn, 'min-h-10')}
                    onClick={() => setEditingAthlete(row)}
                  >
                    Изменить
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(adminCompactDangerBtn, 'min-h-10')}
                    onClick={() => void deleteAthlete(row)}
                  >
                    Удалить
                  </Button>
                </div>
              </article>
            )
          })}
          {!loading && rows.length === 0 && !loadError && (
            <p className="px-3 py-6 text-center text-sm text-muted">
              {hasActiveFilters(filters, search)
                ? 'По выбранным фильтрам спортсмены не найдены. Нажмите «Сбросить фильтры».'
                : 'Спортсмены не найдены.'}
            </p>
          )}
        </div>

        <div className={`${adminTableDesktop} ${adminAthletesTableWrap}`}>
          <Table>
            <thead>
              <tr>
                <th>Спортсмен</th>
                <th>Клуб</th>
                <th>Заявка</th>
                <th>Категория</th>
                <th>Сумма</th>
                <th>Оплата</th>
                <th className="w-[6.5rem]" />
              </tr>
            </thead>
            <tbody>
              {!loading &&
                rows.flatMap((row) => {
                  const name = formatAthleteFullName({
                    lastName: row.lastName,
                    firstName: row.firstName,
                    middleName: row.middleName,
                  })
                  const entryRows = row.entries.length > 0 ? row.entries : [null]
                  const rowSpan = entryRows.length

                  return entryRows.map((entry, entryIndex) => (
                    <tr
                      key={entry?.id ?? `${row.id}-empty`}
                      className={cn(
                        entryIndex === 0
                          ? 'border-t border-border/90 first:border-t-0'
                          : 'border-t border-dashed border-border/95',
                      )}
                    >
                      {entryIndex === 0 && (
                        <>
                          <td rowSpan={rowSpan} className="min-w-48 max-w-56">
                            <p className="m-0 font-semibold leading-snug text-foreground">{name}</p>
                            <p className="mt-1 text-xs leading-snug text-muted">
                              {formatBirthDate(row.birthDate)} · {genderLabel(row.gender)}
                            </p>
                            <div className="mt-2">
                              <RegistrationStatusBadge status={row.registration.status} />
                            </div>
                          </td>
                          <td rowSpan={rowSpan} className="min-w-36 max-w-48 leading-snug">
                            <p className="font-medium text-foreground">{row.registration.clubName}</p>
                            <p className="mt-1 text-xs text-muted">{row.registration.city}</p>
                          </td>
                          <td rowSpan={rowSpan} className="min-w-14 whitespace-nowrap text-[0.8125rem] text-muted">
                            №{row.registration.publicNumber}
                          </td>
                        </>
                      )}

                      {entry ? (
                        <>
                          <td className="min-w-52 leading-snug">{entry.categoryLabel}</td>
                          <td className="min-w-[4.5rem] whitespace-nowrap font-semibold text-accent">
                            {formatMoney(entry.price, { plus: false })}
                          </td>
                          <td className="min-w-[10.5rem]">
                            <div className="flex flex-col items-stretch gap-1.5">
                              <AdminEntryPaymentActions
                                entry={entry}
                                disabled={updatingEntryId === entry.id}
                                selectOnly
                                onUpdate={(entryId, paymentStatus) => void updateEntryStatus(entryId, paymentStatus)}
                                onRequestPaidConfirm={openPaidConfirm}
                                onRequestDebtConfirm={openDebtConfirm}
                              />
                              {canViewApprovedReceipt(entry) && entry.paymentProofId && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className={adminCompactActionBtn}
                                  onClick={() => void viewReceipt(row.registration.id, entry.paymentProofId!)}
                                  disabled={loadingProofId === entry.paymentProofId}
                                >
                                  {loadingProofId === entry.paymentProofId ? 'Загрузка…' : 'Чек'}
                                </Button>
                              )}
                            </div>
                            {updatingEntryId === entry.id && (
                              <p className="mt-1 text-[0.6875rem] text-muted">Сохранение…</p>
                            )}
                          </td>
                        </>
                      ) : (
                        <td className="min-w-52 text-muted" colSpan={3}>
                          Категории не указаны
                        </td>
                      )}

                      {entryIndex === 0 && (
                        <td rowSpan={rowSpan} className="w-[6.5rem] min-w-[6.5rem]">
                          <div className="flex flex-col items-stretch gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              className={adminCompactActionBtn}
                              onClick={() => setEditingAthlete(row)}
                            >
                              Изменить
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className={adminCompactDangerBtn}
                              onClick={() => void deleteAthlete(row)}
                            >
                              Удалить
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                })}
            </tbody>
          </Table>
          {loading && <p className="px-4 py-8 text-center text-sm text-muted">Загрузка…</p>}
          {!loading && rows.length === 0 && !loadError && (
            <p className="px-4 py-8 text-center text-sm text-muted">
              {hasActiveFilters(filters, search)
                ? 'По выбранным фильтрам спортсмены не найдены. Нажмите «Сбросить фильтры».'
                : 'Спортсмены не найдены.'}
            </p>
          )}
        </div>
      </section>

      <AdminConfirmEntryPaymentModal
        open={Boolean(confirmingEntryId)}
        entryId={confirmingEntryId}
        presetStageId={confirmPresetStageId}
        onSubmit={handleConfirmPayment}
        onClose={() => {
          setConfirmingEntryId(null)
          setConfirmPresetStageId(null)
        }}
        onConfirmed={(update) => {
          setConfirmingEntryId(null)
          setConfirmPresetStageId(null)
          setRows((current) =>
            patchEntryPaidInRows(
              current,
              {
                entryId: update.entryId,
                price: update.price,
                paymentStageId: update.paymentStageId,
                paidAt: update.paidAt,
              },
              filters.paymentStatus,
            ),
          )
        }}
      />

      <AdminMarkEntryDebtModal
        open={Boolean(markingDebtEntryId)}
        entryId={markingDebtEntryId}
        onSubmit={handleMarkDebt}
        onClose={() => setMarkingDebtEntryId(null)}
        onConfirmed={(update) => {
          setMarkingDebtEntryId(null)
          setRows((current) => patchEntryDebtInRows(current, update, filters.paymentStatus))
        }}
      />

      <AdminPaymentProofModal
        open={Boolean(viewingProof)}
        registrationId={viewingProof?.registrationId ?? ''}
        proof={viewingProof?.proof ?? null}
        layer="base"
        onClose={() => setViewingProof(null)}
        onReviewed={async () => {
          setViewingProof(null)
          await reloadListPreservingScroll()
        }}
      />

      <AdminAthleteEditModal
        open={Boolean(editingAthlete)}
        athlete={editingAthlete ? toAthleteDetail(editingAthlete) : null}
        pricePerDiscipline={editingAthlete?.registration.pricePerDiscipline ?? 0}
        registrationId={editingAthlete?.registration.id}
        registrationPublicNumber={editingAthlete?.registration.publicNumber}
        hasEditCode={editingAthlete?.registration.hasEditCode ?? false}
        onClose={() => setEditingAthlete(null)}
        onSubmit={(payload) =>
          submitAthleteEdit(payload, {
            mode: 'edit',
            athleteId: editingAthlete!.id,
            registrationId: editingAthlete!.registration.id,
            entryIds: editingAthlete!.entries.map((entry) => entry.id),
          })
        }
        onSaved={async () => {
          setEditingAthlete(null)
          await load()
        }}
        onEditCodeUpdated={async () => {
          await load()
          setEditingAthlete((current) => {
            if (!current) return current
            return {
              ...current,
              registration: { ...current.registration, hasEditCode: true },
            }
          })
        }}
      />

      <AdminAthleteEditModal
        open={creatingAthleteOpen}
        mode="create"
        standaloneCreate
        athlete={null}
        pricePerDiscipline={0}
        onClose={() => setCreatingAthleteOpen(false)}
        onSubmit={submitStandaloneAthleteCreate}
        onSaved={async () => {
          setCreatingAthleteOpen(false)
          await load()
        }}
      />

      {confirm && (
        <AdminRegistrationImpactDialog
          open
          state={confirm}
          loading={impactLoading}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void confirmImpact()}
        />
      )}
    </div>
  )
}
