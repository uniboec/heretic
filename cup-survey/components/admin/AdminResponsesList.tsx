'use client'

import { adminPanel, adminPanelHeader, adminCards, adminTableDesktop, adminTableWrap, adminRowCard, adminCardFields, adminCardField, adminSegmentTab, adminBracketsTabs, adminBracketsToolbar, adminBracketsToolbarGroup, adminBracketsToolbarLabel } from '@/lib/ui/adminSurfaceStyles'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { formatMoney } from '@/lib/formatMoney'
import {
  getPrimaryPackageLabel,
  getPrimaryVenueLabel,
  getResponseEntryFee,
  type SurveyResponseLike,
} from '@/lib/surveyResponse'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Table } from '@/components/ui/Table'

type SurveyResponseRow = SurveyResponseLike & {
  id: string
  createdAt: string
  representativeName: string
  organizationName: string
  phone: string
}

type ResponsesPayload = {
  responses: SurveyResponseRow[]
  total: number
  page: number
  limit: number
}

const PAGE_SIZE = 20

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AdminResponsesList() {
  const [data, setData] = useState<ResponsesPayload | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')

  const load = useCallback(async (pageNum: number) => {
    setError('')
    try {
      const result = await readJsonResponse<ResponsesPayload>(
        await fetch(withBasePath(`/api/admin/responses?page=${pageNum}&limit=${PAGE_SIZE}`)),
      )
      if (!result.ok) {
        setError(result.error)
        return
      }
      setData(result.data)
      setPage(result.data.page)
    } catch {
      setError('Не удалось загрузить список ответов')
    }
  }, [])

  useEffect(() => {
    load(page)
  }, [load, page])

  if (!data) {
    return (
      <section>
        <h2 className="mb-3 text-lg font-semibold">Ответы</h2>
        <p className="text-muted">Загрузка списка…</p>
      </section>
    )
  }

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <section className={`${adminPanel} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-base font-bold text-foreground">Ответы ({data.total})</h2>
        <p className="text-sm text-muted">Только просмотр — удаление отключено.</p>
      </div>

      {error && <p className="px-4 py-3 text-sm text-accent">{error}</p>}

      {data.total === 0 ? (
        <p className="px-4 py-8 text-sm text-muted">Пока нет отправленных анкет.</p>
      ) : (
        <>
          <div className={adminCards}>
            {data.responses.map((row) => (
              <article key={row.id} className={adminRowCard}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{row.organizationName}</p>
                    <p className="mt-0.5 text-sm text-muted">{row.representativeName}</p>
                  </div>
                  <p className="price-value shrink-0 text-base font-bold text-accent">
                    {formatMoney(getResponseEntryFee(row), { plus: false })}
                  </p>
                </div>
                <dl className={adminCardFields}>
                  <div className={adminCardField}>
                    <dt>Дата</dt>
                    <dd>{formatDate(row.createdAt)}</dd>
                  </div>
                  <div className={adminCardField}>
                    <dt>Площадка</dt>
                    <dd className="text-pretty">{getPrimaryVenueLabel(row)}</dd>
                  </div>
                  <div className={adminCardField}>
                    <dt>Пакет</dt>
                    <dd className="text-pretty">{getPrimaryPackageLabel(row)}</dd>
                  </div>
                  <div className={adminCardField}>
                    <dt>Телефон</dt>
                    <dd>{row.phone}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <div className={`${adminTableDesktop} ${adminTableWrap}`}>
            <Table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Клуб</th>
                  <th>Основная площадка</th>
                  <th>Основной пакет</th>
                  <th>Взнос</th>
                  <th>Телефон</th>
                </tr>
              </thead>
              <tbody>
                {data.responses.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap text-muted">{formatDate(row.createdAt)}</td>
                    <td>
                      <div className="font-medium">{row.organizationName}</div>
                      <div className="text-xs text-muted">{row.representativeName}</div>
                    </td>
                    <td className="min-w-40">{getPrimaryVenueLabel(row)}</td>
                    <td className="min-w-48 text-sm">{getPrimaryPackageLabel(row)}</td>
                    <td className="price-value whitespace-nowrap font-semibold text-accent">
                      {formatMoney(getResponseEntryFee(row), { plus: false })}
                    </td>
                    <td className="whitespace-nowrap">{row.phone}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 border-t border-border px-4 py-4">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Назад
              </Button>
              <span className="text-sm text-muted">
                {page} / {totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Вперёд
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
