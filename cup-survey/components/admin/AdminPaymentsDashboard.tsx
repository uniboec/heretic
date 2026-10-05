'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { formatMoney } from '@/lib/formatMoney'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { ProofReviewStatusBadge } from '@/components/ui/ProofReviewStatusBadge'
import { AdminPageHeader } from './AdminPageHeader'
import { AdminStatCard } from './AdminStatCard'
import { AdminPaymentProofModal, type AdminPaymentProofDetail } from './AdminPaymentProofModal'
import {
  adminCardField,
  adminCardFieldLabel,
  adminCardFieldValue,
  adminCardFields,
  adminCards,
  adminFilterPill,
  adminPanel,
  adminPanelHeader,
  adminRowCard,
  adminTableDesktop,
  adminTableWrap,
} from '@/lib/ui/adminSurfaceStyles'

interface PaymentKpi {
  total: number
  pending: number
  approved: number
  rejected: number
  approvedAmount: number
}

interface PaymentRow {
  id: string
  registrationId: string
  status: string
  uploadedAt: string
  reviewedAt: string | null
  amount: number | null
  mimeType: string
  adminComment: string | null
  entryCount: number
  athletesSummary: string
  entries: Array<{
    id: string
    label: string
    athleteName: string
    price: number
    paymentStatus: string
    paymentStatusLabel: string
    paidAt: string | null
  }>
  registration: {
    id: string
    publicNumber: number
    clubName: string
    city: string
    status: string
  }
}

type StatusFilter = '' | 'pending' | 'approved' | 'rejected'

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function proofStatusText(status: string): string {
  if (status === 'approved') return 'Подтверждена'
  if (status === 'rejected') return 'Отклонена'
  return 'На проверке'
}

function paymentDateLabel(row: PaymentRow): string {
  if (row.status === 'approved' && row.reviewedAt) {
    return formatDateTime(row.reviewedAt)
  }
  if (row.status === 'rejected' && row.reviewedAt) {
    return formatDateTime(row.reviewedAt)
  }
  return '—'
}

function toProofDetail(row: PaymentRow): AdminPaymentProofDetail {
  return {
    id: row.id,
    status: row.status,
    uploadedAt: row.uploadedAt,
    amount: row.amount,
    mimeType: row.mimeType,
    adminComment: row.adminComment,
    entries: row.entries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      athleteName: entry.athleteName,
      paymentStatus: entry.paymentStatus as AdminPaymentProofDetail['entries'][number]['paymentStatus'],
    })),
  }
}

export function AdminPaymentsDashboard() {
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [kpi, setKpi] = useState<PaymentKpi | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [viewingProof, setViewingProof] = useState<{
    registrationId: string
    proof: AdminPaymentProofDetail
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (statusFilter) params.set('status', statusFilter)
      const query = params.toString()
      const res = await fetch(withBasePath(`/api/admin/payments${query ? `?${query}` : ''}`))
      const result = await readJsonResponse<{ payments?: PaymentRow[]; kpi?: PaymentKpi | null }>(res)
      if (result.ok) {
        setRows(result.data.payments ?? [])
        setKpi(result.data.kpi ?? null)
      } else {
        setRows([])
        setKpi(null)
      }
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, search ? 250 : 0)

    return () => window.clearTimeout(timer)
  }, [load, search])

  const filteredAmount = useMemo(
    () => rows.reduce((sum, row) => sum + (row.amount ?? 0), 0),
    [rows],
  )

  const openProof = (row: PaymentRow) => {
    setViewingProof({
      registrationId: row.registrationId,
      proof: toProofDetail(row),
    })
  }

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('')
  }

  const hasActiveFilters = Boolean(search.trim() || statusFilter)

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Оплаты"
        description="Все загруженные чеки, даты подтверждения и состав оплат по заявкам."
      />

      {kpi && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <AdminStatCard label="Всего чеков" value={String(kpi.total)} />
          <AdminStatCard label="На проверке" value={String(kpi.pending)} />
          <AdminStatCard label="Подтверждено" value={String(kpi.approved)} />
          <AdminStatCard label="Отклонено" value={String(kpi.rejected)} />
          <AdminStatCard
            label="Сумма подтверждённых"
            value={formatMoney(kpi.approvedAmount, { plus: false })}
          />
        </section>
      )}

      <section className={adminPanel}>
        <div className={adminPanelHeader}>Оплаты ({rows.length})</div>

        <div className="space-y-3 border-b border-border px-3 py-3">
          <label className="flex w-full items-center gap-2">
            <span className="sr-only">Поиск</span>
            <Input
              controlOnly
              density="compact"
              className="w-full"
              placeholder="Клуб, город, спортсмен или № заявки"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {([
              { value: '' as StatusFilter, label: 'Все' },
              { value: 'pending' as StatusFilter, label: 'На проверке' },
              { value: 'approved' as StatusFilter, label: 'Подтверждено' },
              { value: 'rejected' as StatusFilter, label: 'Отклонено' },
            ]).map((option) => (
              <Button
                key={option.value || 'all'}
                type="button"
                variant="ghost"
                className={adminFilterPill(statusFilter === option.value)}
                onClick={() => setStatusFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                className="min-h-9 px-3 py-1.5 text-xs"
                onClick={resetFilters}
              >
                Сбросить
              </Button>
            )}
          </div>

          {hasActiveFilters && (
            <p className="text-xs text-muted">
              В выборке: {rows.length} · на сумму {formatMoney(filteredAmount, { plus: false })}
            </p>
          )}
        </div>

        <div className={adminCards}>
          {loading && rows.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted">Загрузка…</p>
          )}
          {!loading &&
            rows.map((row) => (
              <article key={row.id} className={adminRowCard}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      №{row.registration.publicNumber} · {row.registration.clubName}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{row.registration.city}</p>
                  </div>
                  <ProofReviewStatusBadge status={row.status} label={proofStatusText(row.status)} />
                </div>

                <dl className={adminCardFields}>
                  <div className={adminCardField}>
                    <dt className={adminCardFieldLabel}>Дата оплаты</dt>
                    <dd className={adminCardFieldValue}>{paymentDateLabel(row)}</dd>
                  </div>
                  <div className={adminCardField}>
                    <dt className={adminCardFieldLabel}>Чек загружен</dt>
                    <dd className={adminCardFieldValue}>{formatDateTime(row.uploadedAt)}</dd>
                  </div>
                  <div className={adminCardField}>
                    <dt className={adminCardFieldLabel}>Сумма</dt>
                    <dd className={adminCardFieldValue}>{row.amount != null ? formatMoney(row.amount, { plus: false }) : '—'}</dd>
                  </div>
                  <div className={adminCardField}>
                    <dt className={adminCardFieldLabel}>Состав</dt>
                    <dd className={adminCardFieldValue}>{row.entryCount} кат. · {row.athletesSummary || '—'}</dd>
                  </div>
                </dl>

                {row.adminComment && (
                  <p className="mt-3 text-xs leading-snug text-muted">Комментарий: {row.adminComment}</p>
                )}

                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-9 px-3 py-1.5 text-xs"
                    onClick={() => openProof(row)}
                  >
                    {row.status === 'pending' ? 'Проверить' : 'Чек'}
                  </Button>
                </div>
              </article>
            ))}
          {!loading && rows.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted">Оплаты не найдены.</p>
          )}
        </div>

        <div className={`${adminTableDesktop} ${adminTableWrap}`}>
          <Table>
            <thead>
              <tr>
                <th>Дата оплаты</th>
                <th>Чек загружен</th>
                <th>Заявка</th>
                <th>Клуб</th>
                <th>Спортсмены</th>
                <th>Кат.</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!loading &&
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap">{paymentDateLabel(row)}</td>
                    <td className="whitespace-nowrap">{formatDateTime(row.uploadedAt)}</td>
                    <td>№{row.registration.publicNumber}</td>
                    <td>
                      <p className="font-medium text-foreground">{row.registration.clubName}</p>
                      <p className="text-xs text-muted">{row.registration.city}</p>
                    </td>
                    <td className="max-w-[14rem] truncate">{row.athletesSummary || '—'}</td>
                    <td>{row.entryCount}</td>
                    <td className="whitespace-nowrap font-semibold text-accent">
                      {row.amount != null ? formatMoney(row.amount, { plus: false }) : '—'}
                    </td>
                    <td>
                      <ProofReviewStatusBadge status={row.status} label={proofStatusText(row.status)} />
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-9 px-3 py-1.5 text-xs"
                        onClick={() => openProof(row)}
                      >
                        {row.status === 'pending' ? 'Проверить' : 'Чек'}
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </Table>
          {loading && <p className="px-4 py-8 text-center text-sm text-muted">Загрузка…</p>}
          {!loading && rows.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted">Оплаты не найдены.</p>
          )}
        </div>
      </section>

      <AdminPaymentProofModal
        open={Boolean(viewingProof)}
        registrationId={viewingProof?.registrationId ?? ''}
        proof={viewingProof?.proof ?? null}
        layer="base"
        onClose={() => setViewingProof(null)}
        onReviewed={async () => {
          setViewingProof(null)
          await load()
        }}
      />
    </div>
  )
}
