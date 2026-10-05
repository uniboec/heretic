'use client'

import { useCallback, useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { formatMoney } from '@/lib/formatMoney'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table } from '@/components/ui/Table'
import { formatAthleteFullName } from '@/lib/registration/athleteName'
import type { RegistrationStatus } from '@/lib/registration/status'
import { AdminPageHeader } from './AdminPageHeader'
import { AdminStatCard } from './AdminStatCard'
import { RegistrationStatusBadge } from './RegistrationStatusBadge'
import { AdminAthleteEditModal, type AdminAthleteDetail } from './AdminAthleteEditModal'
import { AdminPaymentProofModal, type AdminPaymentProofDetail } from './AdminPaymentProofModal'
import {
  AdminRegistrationDetailModal,
  type AdminRegistrationDetail,
  type AdminRegistrationRow,
} from './AdminRegistrationDetailModal'
import { AdminRegistrationImpactDialog } from './AdminRegistrationImpactDialog'
import { useRegistrationImpactFlow } from './useRegistrationImpactFlow'
import {
  fingerprintEntryPaymentStatus,
  fingerprintRegistrationCancelled,
  fingerprintReviewPayment,
  fingerprintConfirmPayment,
  fingerprintMarkDebt,
  fingerprintAthleteDelete,
} from '@/lib/registration/adminImpact'
import { BRACKET_IMPACT_CONFIRM } from '@/lib/brackets/labels'
import {
  adminCardField,
  adminCardFieldLabel,
  adminCardFieldValue,
  adminCardFields,
  adminCards,
  adminPageActionsBtn,
  adminPanel,
  adminPanelHeader,
  adminRowCardButton,
  adminTableDesktop,
  adminTableWrap,
} from '@/lib/ui/adminSurfaceStyles'
interface Kpi {
  athletes: number
  entries: number
  charged: number
  confirmed: number
  admitted: number
  pending: number
  registrations: number
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AdminRegistrationsDashboard() {
  const { confirm, loading: impactLoading, setConfirm, runWithImpact, confirmImpact } =
    useRegistrationImpactFlow()
  const [kpi, setKpi] = useState<Kpi | null>(null)
  const [rows, setRows] = useState<AdminRegistrationRow[]>([])
  const [selected, setSelected] = useState<AdminRegistrationRow | null>(null)
  const [detail, setDetail] = useState<AdminRegistrationDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [editingAthlete, setEditingAthlete] = useState<AdminAthleteDetail | null>(null)
  const [creatingAthlete, setCreatingAthlete] = useState(false)
  const [reviewingProof, setReviewingProof] = useState<AdminPaymentProofDetail | null>(null)
  const load = useCallback(async () => {
    try {
      const [kpiRes, listRes] = await Promise.all([
        fetch(withBasePath('/api/admin/registrations/kpi')),
        fetch(withBasePath('/api/admin/registrations')),
      ])

      const kpiResult = await readJsonResponse<Kpi>(kpiRes)
      if (kpiResult.ok) setKpi(kpiResult.data)

      const listResult = await readJsonResponse<{ registrations?: AdminRegistrationRow[] }>(listRes)
      if (listResult.ok) setRows(listResult.data.registrations ?? [])
    } catch {
      setKpi(null)
      setRows([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const closeDetail = () => {
    setSelected(null)
    setDetail(null)
    setEditingAthlete(null)
    setCreatingAthlete(false)
    setReviewingProof(null)
  }

  const openDetail = async (row: AdminRegistrationRow) => {
    setSelected(row)
    setLoadingDetail(true)
    setDetail(null)
    setEditingAthlete(null)
    setReviewingProof(null)
    try {
      const res = await fetch(withBasePath(`/api/admin/registrations/${row.id}`))
      const result = await readJsonResponse<AdminRegistrationDetail>(res)
      setDetail(result.ok ? result.data : null)
    } finally {
      setLoadingDetail(false)
    }
  }

  const refreshDetail = async () => {
    if (!selected) return
    const res = await fetch(withBasePath(`/api/admin/registrations/${selected.id}`))
    const result = await readJsonResponse<AdminRegistrationDetail>(res)
    setDetail(result.ok ? result.data : null)
    await load()
  }

  const cancelRegistration = async () => {
    if (!selected || !window.confirm('Отменить заявку?')) return
    const ok = await runWithImpact({
      registrationId: selected.id,
      mutationFingerprint: fingerprintRegistrationCancelled(selected.id),
      title: BRACKET_IMPACT_CONFIRM.registrationTitle,
      body: BRACKET_IMPACT_CONFIRM.registrationBody,
      execute: (impactToken) =>
        fetch(withBasePath(`/api/admin/registrations/${selected.id}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'CANCELLED', ...(impactToken ? { impactToken } : {}) }),
        }),
    })
    if (!ok) return
    await load()
    const detailRes = await fetch(withBasePath(`/api/admin/registrations/${selected.id}`))
    const detailResult = await readJsonResponse<AdminRegistrationDetail>(detailRes)
    setDetail(detailResult.ok ? detailResult.data : null)
    setSelected((current) => (current ? { ...current, status: 'CANCELLED' as RegistrationStatus } : current))
  }

  const deleteAthlete = async (athlete: AdminAthleteDetail) => {
    if (!selected) return
    const name = formatAthleteFullName({
      lastName: athlete.lastName,
      firstName: athlete.firstName,
      middleName: athlete.middleName,
    })
    if (!window.confirm(`Удалить спортсмена ${name}?`)) return

    const ok = await runWithImpact({
      registrationId: selected.id,
      mutationFingerprint: fingerprintAthleteDelete(athlete.id, selected.id),
      title: BRACKET_IMPACT_CONFIRM.registrationTitle,
      body: BRACKET_IMPACT_CONFIRM.registrationBody,
      execute: (impactToken) =>
        fetch(withBasePath(`/api/admin/registrations/athletes/${athlete.id}`), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(impactToken ? { impactToken } : {}),
        }),
    })

    if (!ok) return
    await refreshDetail()
  }

  const updateEntryStatus = async (entryId: string, paymentStatus: string) => {
    if (!selected || !detail) return
    let previousStatus = 'UNPAID'
    for (const athlete of detail.athletes) {
      const entry = athlete.entries.find((item) => item.id === entryId)
      if (entry) {
        previousStatus = entry.paymentStatus ?? 'UNPAID'
        break
      }
    }

    const ok = await runWithImpact({
      registrationId: selected.id,
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
    if (!ok) return
    await refreshDetail()
  }

  const reviewPaymentProof = async (
    proof: AdminPaymentProofDetail,
    action: 'approve' | 'reject',
    comment: string,
    impactToken?: string,
  ) =>
    fetch(withBasePath(`/api/admin/registrations/${selected!.id}/review-payment`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        comment,
        proofId: proof.id,
        ...(impactToken ? { impactToken } : {}),
      }),
    })

  const handleReviewProof = async (
    proof: AdminPaymentProofDetail,
    action: 'approve' | 'reject',
    comment: string,
  ) => {
    if (!selected) return false
    return runWithImpact({
      registrationId: selected.id,
      mutationFingerprint: fingerprintReviewPayment({
        registrationId: selected.id,
        action,
        entryIds: proof.entries.map((entry) => entry.id),
      }),
      entryIds: proof.entries.map((entry) => entry.id),
      title: BRACKET_IMPACT_CONFIRM.registrationTitle,
      body: BRACKET_IMPACT_CONFIRM.registrationBody,
      execute: (impactToken) => reviewPaymentProof(proof, action, comment, impactToken),
    })
  }

  const handleConfirmPayment = async (input: {
    entryId: string
    paymentStageId: string
    paidAt: string
    comment: string
    withoutProof: boolean
    impactToken?: string
  }) => {
    if (!selected) {
      return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 400 })
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
      registrationId: selected.id,
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
    if (!selected) {
      return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 400 })
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
      registrationId: selected.id,
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

  const exportActions = (
    <>
      <a href={withBasePath('/api/admin/registrations/export?format=csv')}>
        <Button variant="secondary" className={adminPageActionsBtn}>CSV</Button>
      </a>
      <a href={withBasePath('/api/admin/registrations/export?format=xlsx')}>
        <Button variant="secondary" className={adminPageActionsBtn}>XLSX</Button>
      </a>
    </>
  )

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Регистрация турнира"
        description="Заявки клубов, проверка оплат и экспорт списков участников."
        actions={exportActions}
      />

      {kpi && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <AdminStatCard label="Спортсменов" value={String(kpi.athletes)} />
          <AdminStatCard label="Категорий" value={String(kpi.entries)} />
          <AdminStatCard label="Начислено" value={formatMoney(kpi.charged, { plus: false })} />
          <AdminStatCard label="Оплачено" value={formatMoney(kpi.confirmed, { plus: false })} />
          <AdminStatCard label="Допущено" value={formatMoney(kpi.admitted, { plus: false })} />
          <AdminStatCard label="Ожидается" value={formatMoney(kpi.pending, { plus: false })} />
        </section>
      )}

      <section className={adminPanel}>
        <div className={adminPanelHeader}>Заявки ({rows.length})</div>

        <div className={adminCards}>
          {rows.map((row) => (
            <Button
              key={row.id}
              type="button"
              variant="ghost"
              className={adminRowCardButton}
              onClick={() => openDetail(row)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-left">
                  <p className="font-semibold text-foreground">№{row.publicNumber} · {row.clubName}</p>
                  <p className="mt-0.5 text-xs text-muted">{row.city} · {formatDateTime(row.createdAt)}</p>
                </div>
                <p className="shrink-0 text-sm font-bold text-accent">
                  {formatMoney(row.totalAmount, { plus: false })}
                </p>
              </div>
              <dl className={adminCardFields}>
                <div className={adminCardField}>
                  <dt className={adminCardFieldLabel}>Состав</dt>
                  <dd className={adminCardFieldValue}>{row.athletesCount} спортсм. · {row.entryCount} кат.</dd>
                </div>
                <div className={adminCardField}>
                  <dt className={adminCardFieldLabel}>Статус</dt>
                  <dd className={`${adminCardFieldValue} flex flex-wrap items-center gap-2`}>
                    <RegistrationStatusBadge status={row.status} />
                    {row.hasProof && <StatusBadge tone="warning">Есть чек</StatusBadge>}
                  </dd>
                </div>
              </dl>
            </Button>
          ))}
          {rows.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted">Заявок пока нет.</p>
          )}
        </div>

        <div className={`${adminTableDesktop} ${adminTableWrap}`}>
          <Table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>№</th>
                <th>Клуб</th>
                <th>Город</th>
                <th>Спортсмены</th>
                <th>Категории</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>Чек</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer hover:bg-accent-soft/40"
                  onClick={() => openDetail(row)}
                >
                  <td className="whitespace-nowrap text-muted">{formatDateTime(row.createdAt)}</td>
                  <td className="font-medium">{row.publicNumber}</td>
                  <td className="font-medium">{row.clubName}</td>
                  <td className="text-muted">{row.city}</td>
                  <td>{row.athletesCount}</td>
                  <td>{row.entryCount}</td>
                  <td className="font-semibold text-accent">{formatMoney(row.totalAmount, { plus: false })}</td>
                  <td><RegistrationStatusBadge status={row.status} /></td>
                  <td>{row.hasProof ? 'Да' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          {rows.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted">Заявок пока нет.</p>
          )}
        </div>
      </section>

      <AdminRegistrationDetailModal
        open={Boolean(selected)}
        registration={selected}
        detail={detail}
        loading={loadingDetail}
        onClose={closeDetail}
        onCancelRegistration={cancelRegistration}
        onAddAthlete={() => {
          setEditingAthlete(null)
          setCreatingAthlete(true)
        }}
        onEditAthlete={(athlete) => {
          setCreatingAthlete(false)
          setEditingAthlete(athlete)
        }}
        onDeleteAthlete={deleteAthlete}
        onUpdateEntryStatus={updateEntryStatus}
        onReviewProof={setReviewingProof}
        onEditCodeUpdated={refreshDetail}
        onPaymentConfirmed={refreshDetail}
        onConfirmPayment={handleConfirmPayment}
        onMarkDebt={handleMarkDebt}
      />

      <AdminAthleteEditModal
        open={Boolean(editingAthlete) || creatingAthlete}
        mode={creatingAthlete ? 'create' : 'edit'}
        athlete={editingAthlete}
        pricePerDiscipline={detail?.pricePerDiscipline ?? 0}
        registrationId={selected?.id}
        registrationPublicNumber={selected?.publicNumber}
        hasEditCode={detail?.hasEditCode ?? false}
        onClose={() => {
          setEditingAthlete(null)
          setCreatingAthlete(false)
        }}
        onSaved={refreshDetail}
        onEditCodeUpdated={refreshDetail}
      />

      {selected && (
        <AdminPaymentProofModal
          open={Boolean(reviewingProof)}
          registrationId={selected.id}
          proof={reviewingProof}
          onClose={() => setReviewingProof(null)}
          onReviewed={refreshDetail}
          onReview={
            reviewingProof
              ? (proof, action, comment) => handleReviewProof(proof, action, comment)
              : undefined
          }
        />
      )}

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
