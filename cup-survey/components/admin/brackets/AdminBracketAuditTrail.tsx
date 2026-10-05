'use client'

import { useCallback, useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { getCategoryTitleFromKey } from '@/lib/registration/categoryIdentity'
import { BRACKET_MOVE_ACTION_LABELS } from '@/lib/brackets/labels'

interface AuditRow {
  id: string
  entryId: string
  action: 'MOVE' | 'RESET'
  fromCategoryKey: string
  toCategoryKey: string
  movedAt: string
}

interface AdminBracketAuditTrailProps {
  entryId: string
  categoryTitleMap?: Map<string, string>
}

export function AdminBracketAuditTrail({
  entryId,
  categoryTitleMap,
}: AdminBracketAuditTrailProps) {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(withBasePath(`/api/admin/brackets/audit/entry/${entryId}`))
      const result = await readJsonResponse<{ audit?: AuditRow[] }>(res)
      setRows(result.ok ? (result.data.audit ?? []) : [])
    } finally {
      setLoading(false)
    }
  }, [entryId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <p className="text-xs text-muted">Загрузка истории…</p>
  if (rows.length === 0) return null

  const labelFor = (key: string) => categoryTitleMap?.get(key) ?? getCategoryTitleFromKey(key)

  return (
    <div className="rounded-lg border border-border bg-muted/10 p-3">
      <ul className="space-y-2 text-sm text-muted">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {BRACKET_MOVE_ACTION_LABELS[row.action] ?? row.action}: {labelFor(row.fromCategoryKey)} →{' '}
              {labelFor(row.toCategoryKey)}
            </span>
            <span className="text-xs">{new Date(row.movedAt).toLocaleString('ru-RU')}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
