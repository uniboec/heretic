'use client'

import { cn } from '@/lib/cn'
import { adminPanel, adminPanelHeader, adminCards, adminTableDesktop, adminTableWrap, adminRowCard, adminCardFields, adminCardField, adminSegmentTab, adminBracketsTabs, adminBracketsToolbar, adminBracketsToolbarGroup, adminBracketsToolbarLabel } from '@/lib/ui/adminSurfaceStyles'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Table } from '@/components/ui/Table'
import { BRACKET_MOVE_ACTION_LABELS, BRACKET_PARTICIPANT_ACTION_LABELS } from '@/lib/brackets/labels'
import { bracketAdminFetch } from './bracketAdminUtils'

export interface MoveHistoryRow {
  id: string
  entryId: string
  action: 'MOVE' | 'RESET'
  fromCategoryTitle: string
  toCategoryTitle: string
  movedAt: string
  displayName: string
  canUndo: boolean
}

interface AdminBracketMoveHistoryProps {
  draftId: string | null
  draftVersion: number | null
  busy: boolean
  onDraftChange: (draft: { id: string; version: number }) => void
  onUpdated: () => void
  onToast: (message: string, type?: 'error' | 'success') => void
}

export function AdminBracketMoveHistory({
  draftId,
  draftVersion,
  busy,
  onDraftChange,
  onUpdated,
  onToast,
}: AdminBracketMoveHistoryProps) {
  const [rows, setRows] = useState<MoveHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [undoingId, setUndoingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await bracketAdminFetch<{ audit: MoveHistoryRow[] }>(
        '/api/admin/brackets/audit?limit=100',
      )
      if (!result.ok) {
        onToast(result.message, 'error')
        setRows([])
        return
      }
      setRows(result.data.audit ?? [])
    } finally {
      setLoading(false)
    }
  }, [onToast])

  useEffect(() => {
    void load()
  }, [load, draftVersion])

  const undo = async (auditId: string) => {
    if (!draftId || draftVersion == null) {
      onToast('Черновик сеток не найден', 'error')
      return
    }
    setUndoingId(auditId)
    try {
      const result = await bracketAdminFetch<{ draft: { id: string; version: number } }>(
        `/api/admin/brackets/audit/${auditId}/undo`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftId, expectedVersion: draftVersion }),
        },
      )
      if (!result.ok) {
        onToast(result.message, 'error')
        return
      }
      onDraftChange(result.data.draft)
      onToast('Действие отменено', 'success')
      onUpdated()
      await load()
    } finally {
      setUndoingId(null)
    }
  }

  return (
    <section className={adminPanel}>
      <div className={cn(adminPanelHeader, 'flex items-center justify-between gap-3')}>
        <span>История переносов</span>
        <Button variant="ghost" type="button" disabled={loading || busy} onClick={() => void load()}>
          Обновить
        </Button>
      </div>
      <div className="p-3">
        {loading ? (
          <p className="text-sm text-muted">Загрузка истории…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">Переносов пока не было.</p>
        ) : (
          <div className={`${adminTableWrap} ${adminTableDesktop}`}>
            <Table className="w-full min-w-[48rem]">
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Участник</th>
                  <th>Действие</th>
                  <th>Из категории</th>
                  <th>В категорию</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap text-muted">
                      {new Date(row.movedAt).toLocaleString('ru-RU')}
                    </td>
                    <td className="font-medium">{row.displayName}</td>
                    <td>{BRACKET_MOVE_ACTION_LABELS[row.action] ?? row.action}</td>
                    <td>{row.fromCategoryTitle}</td>
                    <td>{row.toCategoryTitle}</td>
                    <td className="text-right">
                      {row.canUndo ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy || undoingId === row.id || !draftId}
                          onClick={() => void undo(row.id)}
                        >
                          {undoingId === row.id
                            ? `${BRACKET_PARTICIPANT_ACTION_LABELS.cancel}…`
                            : BRACKET_PARTICIPANT_ACTION_LABELS.undoMove}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          Откат можно выполнить только для последнего действия по участнику, если его текущее размещение совпадает
          с записью.
        </p>
      </div>
    </section>
  )
}
