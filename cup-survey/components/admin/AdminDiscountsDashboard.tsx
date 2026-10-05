'use client'

import { adminPageActionsBtn, adminPanel, adminPanelHeader, adminCards, adminTableDesktop, adminTableWrap, adminRowCard, adminCardFields, adminCardField, adminSegmentTab, adminBracketsTabs, adminBracketsToolbar, adminBracketsToolbarGroup, adminBracketsToolbarLabel } from '@/lib/ui/adminSurfaceStyles'
import { useCallback, useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import {
  formatCategoryDiscountSchedule,
  formatCategoryDiscountScope,
  formatCategoryDiscountStatus,
  formatCategoryDiscountTitle,
} from '@/lib/registration/categoryDiscountLabels'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table } from '@/components/ui/Table'
import { AdminPageHeader } from './AdminPageHeader'
import { AdminStatCard } from './AdminStatCard'
import {
  AdminDiscountRuleEditModal,
  type AdminDiscountRuleRow,
} from './AdminDiscountRuleEditModal'

function loadErrorMessage(error: string | undefined): string {
  if (error === 'DB_MIGRATION_REQUIRED') {
    return 'Нужно обновить базу данных: npm run db:deploy'
  }
  if (error === 'Unauthorized') {
    return 'Сессия админки истекла. Войдите снова.'
  }
  return 'Не удалось загрузить правила скидок.'
}

export function AdminDiscountsDashboard() {
  const [rows, setRows] = useState<AdminDiscountRuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editingRule, setEditingRule] = useState<AdminDiscountRuleRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await readJsonResponse<{ rules?: AdminDiscountRuleRow[]; error?: string }>(
        await fetch(withBasePath('/api/admin/discount-rules')),
      )
      if (!result.ok) {
        setRows([])
        const code =
          result.body && typeof result.body === 'object' && 'error' in result.body
            ? String((result.body as { error?: string }).error)
            : undefined
        setLoadError(loadErrorMessage(code))
        return
      }
      setRows(result.data.rules ?? [])
    } catch {
      setRows([])
      setLoadError('Не удалось загрузить правила скидок.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const activeCount = rows.filter((row) => formatCategoryDiscountStatus(row) === 'Активно').length
  const publicCount = rows.filter((row) => row.showOnSite).length

  const removeRule = async (rule: AdminDiscountRuleRow) => {
    if (!window.confirm(`Удалить правило «${formatCategoryDiscountTitle(rule)}»?`)) return

    setDeletingId(rule.id)
    try {
      const result = await readJsonResponse(
        await fetch(withBasePath(`/api/admin/discount-rules/${rule.id}`), {
          method: 'DELETE',
        }),
      )
      if (!result.ok) {
        window.alert(result.error)
        return
      }
      setRows((prev) => prev.filter((row) => row.id !== rule.id))
    } finally {
      setDeletingId(null)
    }
  }

  const handleSaved = (rule: AdminDiscountRuleRow) => {
    setRows((prev) => {
      const index = prev.findIndex((row) => row.id === rule.id)
      if (index < 0) return [...prev, rule]
      const next = [...prev]
      next[index] = rule
      return next
    })
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Скидки"
        description="Правила скидок по дисциплинам, уровням и возрастным группам. Для каждой категории применяется самая выгодная скидка — клубная или по правилам."
        actions={
          <Button type="button" className={adminPageActionsBtn} onClick={() => setCreating(true)}>
            Добавить правило
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <AdminStatCard label="Правил" value={loading ? '…' : String(rows.length)} />
        <AdminStatCard label="Активных" value={loading ? '…' : String(activeCount)} />
        <AdminStatCard label="На сайте" value={loading ? '…' : String(publicCount)} />
      </section>

      {loadError && (
        <p className="rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-foreground">
          {loadError}
        </p>
      )}

      <section className={adminPanel}>
        <div className={adminPanelHeader}>Правила скидок ({rows.length})</div>

        <div className={adminCards}>
          {loading && <p className="px-3 py-6 text-center text-sm text-muted">Загрузка…</p>}

          {!loading && rows.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted">
              Правил пока нет. Добавьте первое правило скидки.
            </p>
          )}

          {!loading &&
            rows.map((row) => {
              const status = formatCategoryDiscountStatus(row)
              const schedule = formatCategoryDiscountSchedule(row)

              return (
                <article key={row.id} className={adminRowCard}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{formatCategoryDiscountTitle(row)}</p>
                        <StatusBadge tone="success">−{row.discountPercent}%</StatusBadge>
                        <StatusBadge tone="neutral">{status}</StatusBadge>
                        {row.showOnSite && <StatusBadge tone="info">На сайте</StatusBadge>}
                      </div>
                      <p className="mt-1 text-sm text-muted">{formatCategoryDiscountScope(row)}</p>
                      {row.description && (
                        <p className="mt-2 text-sm text-foreground">{row.description}</p>
                      )}
                      {schedule && <p className="mt-1 text-xs text-muted">{schedule}</p>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-9 px-3 py-1.5 text-xs"
                        onClick={() => setEditingRule(row)}
                      >
                        Изменить
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-9 px-3 py-1.5 text-xs text-danger hover:bg-danger-soft"
                        disabled={deletingId === row.id}
                        onClick={() => void removeRule(row)}
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>
                </article>
              )
            })}
        </div>

        <div className={`${adminTableDesktop} overflow-x-auto`}>
          <Table className="w-full min-w-[56rem]">
            <thead>
              <tr>
                <th>Название</th>
                <th>Условия</th>
                <th>Скидка</th>
                <th>Статус</th>
                <th>Показ</th>
                <th>Период</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!loading &&
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">
                      <div>{formatCategoryDiscountTitle(row)}</div>
                      {row.description && (
                        <div className="mt-1 text-xs font-normal text-muted">{row.description}</div>
                      )}
                    </td>
                    <td>{formatCategoryDiscountScope(row)}</td>
                    <td>−{row.discountPercent}%</td>
                    <td>{formatCategoryDiscountStatus(row)}</td>
                    <td>{row.showOnSite ? 'На сайте' : 'Скрыто'}</td>
                    <td>{formatCategoryDiscountSchedule(row) ?? 'Без ограничений'}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-9 px-3 py-1.5 text-xs"
                          onClick={() => setEditingRule(row)}
                        >
                          Изменить
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="min-h-9 px-3 py-1.5 text-xs text-danger hover:bg-danger-soft"
                          disabled={deletingId === row.id}
                          onClick={() => void removeRule(row)}
                        >
                          Удалить
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </div>
      </section>

      <AdminDiscountRuleEditModal
        open={creating}
        rule={null}
        onClose={() => setCreating(false)}
        onSaved={handleSaved}
      />

      <AdminDiscountRuleEditModal
        open={Boolean(editingRule)}
        rule={editingRule}
        onClose={() => setEditingRule(null)}
        onSaved={handleSaved}
      />
    </div>
  )
}

