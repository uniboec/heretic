'use client'

import { useCallback, useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { AdminPageHeader } from './AdminPageHeader'
import { AdminStatCard } from './AdminStatCard'
import { AdminClubEditModal, type AdminClubRow } from './AdminClubEditModal'
import {
  adminCardField,
  adminCardFieldLabel,
  adminCardFieldValue,
  adminCardFields,
  adminCards,
  adminPanel,
  adminPanelHeader,
  adminRowCard,
  adminTableDesktop,
  adminTableWrap,
} from '@/lib/ui/adminSurfaceStyles'

function formatDiscount(discountPercent: number | null): string {
  return discountPercent && discountPercent > 0 ? `${discountPercent}%` : '—'
}

function pluralRegistrations(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'заявка'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'заявки'
  return 'заявок'
}

function loadErrorMessage(error: string | undefined): string {
  if (error === 'DB_MIGRATION_REQUIRED') {
    return 'Нужно обновить базу данных: npm run db:deploy'
  }
  if (error === 'Unauthorized') {
    return 'Сессия админки истекла. Войдите снова.'
  }
  return 'Не удалось загрузить клубы.'
}

export function AdminClubsDashboard() {
  const [rows, setRows] = useState<AdminClubRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editingClub, setEditingClub] = useState<AdminClubRow | null>(null)

  const load = useCallback(async (query = search) => {
    setLoading(true)
    setLoadError(null)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      const result = await readJsonResponse<{ clubs?: AdminClubRow[]; error?: string }>(
        await fetch(withBasePath(`/api/admin/clubs?${params}`)),
      )

      if (!result.ok) {
        setRows([])
        const errorCode =
          result.body && typeof result.body === 'object' && 'error' in result.body
            ? String((result.body as { error?: string }).error)
            : undefined
        setLoadError(loadErrorMessage(errorCode ?? result.error))
        return
      }

      setRows(result.data.clubs ?? [])
    } catch {
      setRows([])
      setLoadError('Не удалось загрузить клубы.')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, search ? 250 : 0)

    return () => window.clearTimeout(timer)
  }, [load, search])

  const linkedRegistrations = rows.reduce((sum, row) => sum + row.registrationsCount, 0)
  const totalAthletes = rows.reduce((sum, row) => sum + row.athletesCount, 0)
  const totalEntries = rows.reduce((sum, row) => sum + row.entriesCount, 0)

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Клубы"
        description="Справочник клубов турнира. Можно изменить название, город и индивидуальную скидку на регистрацию."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Клубов" value={loading ? '…' : String(rows.length)} />
        <AdminStatCard label="Связанных заявок" value={loading ? '…' : String(linkedRegistrations)} />
        <AdminStatCard label="Спортсменов" value={loading ? '…' : String(totalAthletes)} />
        <AdminStatCard label="Категорий" value={loading ? '…' : String(totalEntries)} />
      </section>

      {loadError && (
        <p className="rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-foreground">
          {loadError}
        </p>
      )}

      <section className={adminPanel}>
        <div className={`${adminPanelHeader} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
          <span>Клубы ({rows.length})</span>
          <label className="flex w-full max-w-md items-center gap-2">
            <span className="sr-only">Поиск</span>
            <Input
              controlOnly
              density="compact"
              className="w-full"
              placeholder="Название или город"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        <div className={adminCards}>
          {loading && <p className="px-3 py-6 text-center text-sm text-muted">Загрузка…</p>}
          {!loading && rows.map((row) => (
            <article key={row.id} className={adminRowCard}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{row.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{row.city}</p>
                </div>
                <Button
                  variant="secondary"
                  className="min-h-9 shrink-0 px-3 py-1.5 text-xs"
                  onClick={() => setEditingClub(row)}
                >
                  Изменить
                </Button>
              </div>
              <dl className={adminCardFields}>
                <div className={adminCardField}>
                  <dt className={adminCardFieldLabel}>Заявок</dt>
                  <dd className={adminCardFieldValue}>{row.registrationsCount} {pluralRegistrations(row.registrationsCount)}</dd>
                </div>
                <div className={adminCardField}>
                  <dt className={adminCardFieldLabel}>Спортсмены</dt>
                  <dd className={adminCardFieldValue}>{row.athletesCount} спортсм. · {row.entriesCount} кат.</dd>
                </div>
                <div className={adminCardField}>
                  <dt className={adminCardFieldLabel}>Скидка</dt>
                  <dd className={adminCardFieldValue}>{formatDiscount(row.discountPercent)}</dd>
                </div>
              </dl>
            </article>
          ))}
          {!loading && rows.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted">Клубы не найдены.</p>
          )}
        </div>

        <div className={`${adminTableDesktop} ${adminTableWrap}`}>
          <Table>
            <thead>
              <tr>
                <th>Клуб</th>
                <th>Город</th>
                <th>Спортсменов</th>
                <th>Категорий</th>
                <th>Скидка</th>
                <th>Заявок</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!loading && rows.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium">{row.name}</td>
                  <td className="text-muted">{row.city}</td>
                  <td className="whitespace-nowrap text-muted">{row.athletesCount}</td>
                  <td className="whitespace-nowrap text-muted">{row.entriesCount}</td>
                  <td className="whitespace-nowrap text-muted">{formatDiscount(row.discountPercent)}</td>
                  <td className="whitespace-nowrap text-muted">{row.registrationsCount}</td>
                  <td className="whitespace-nowrap">
                    <div className="flex justify-end">
                      <Button
                        variant="secondary"
                        className="min-h-9 px-3 py-1.5 text-xs"
                        onClick={() => setEditingClub(row)}
                      >
                        Изменить
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {loading && <p className="px-4 py-8 text-center text-sm text-muted">Загрузка…</p>}
          {!loading && rows.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted">Клубы не найдены.</p>
          )}
        </div>
      </section>

      <AdminClubEditModal
        open={Boolean(editingClub)}
        club={editingClub}
        onClose={() => setEditingClub(null)}
        onSaved={(club) => {
          setEditingClub(null)
          setRows((current) => current.map((row) => (row.id === club.id ? club : row)))
        }}
      />
    </div>
  )
}
