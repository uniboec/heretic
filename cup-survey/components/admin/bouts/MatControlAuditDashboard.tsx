'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { routes } from '@/lib/routes'
import { Button } from '@/components/ui/Button'
import { adminPanel } from '@/lib/ui/adminSurfaceStyles'

type AuditEntry = {
  id: string
  boutId: string
  issueCode: string
  issueMessage: string
  victoryMethod: string | null
  detectedAt: string
  resolvedAt: string | null
  resolutionNote: string | null
}

type DashboardData = {
  openFindings: Array<{
    boutId: string
    issueCode: string
    issueMessage: string
    victoryMethod: string | null
  }>
  auditEntries: AuditEntry[]
  correctionCases: Array<{
    id: string
    sourceBoutId: string
    reason: string
    requestedBy: string
    appliedAt: string | null
    status: string
    createdAt: string
  }>
}

export function MatControlAuditDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await fetch(withBasePath('/api/admin/bouts/mat-control-audit'))
    const result = await readJsonResponse<DashboardData>(res)
    if (!result.ok) {
      setError(result.error ?? 'Не удалось загрузить аудит')
      return
    }
    setData(result.data ?? null)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const scan = async () => {
    setBusy(true)
    try {
      const res = await fetch(withBasePath('/api/admin/bouts/mat-control-audit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan' }),
      })
      const result = await readJsonResponse(res)
      if (!result.ok) {
        setError(result.error ?? 'Сканирование не удалось')
        return
      }
      await load()
    } finally {
      setBusy(false)
    }
  }

  const resolveEntry = async (entryId: string) => {
    const note = window.prompt('Комментарий к закрытию записи аудита') ?? ''
    const res = await fetch(withBasePath(`/api/admin/bouts/mat-control-audit/${entryId}/resolve`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolutionNote: note }),
    })
    const result = await readJsonResponse(res)
    if (!result.ok) {
      setError(result.error ?? 'Не удалось закрыть запись')
      return
    }
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void scan()} disabled={busy}>
          Сканировать подозрительные результаты
        </Button>
        <Link href={routes.admin.bouts} className="text-sm text-muted underline">
          ← К расписанию
        </Link>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className={adminPanel}>
        <h2 className="text-base font-semibold">Открытые находки (runtime scan)</h2>
        <div className="mt-3 space-y-2">
          {(data?.openFindings ?? []).length === 0 ? (
            <p className="text-sm text-muted">Подозрительных подтверждённых боёв не найдено.</p>
          ) : (
            data?.openFindings.map((finding) => (
              <div key={`${finding.boutId}-${finding.issueCode}`} className="rounded border border-border p-3 text-sm">
                <p className="font-medium">{finding.boutId}</p>
                <p className="text-muted">{finding.issueCode}</p>
                <p>{finding.issueMessage}</p>
                <p className="mt-1 text-xs text-muted">
                  Исправление: откройте бой на ковре или используйте коррекцию в расписании.
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className={adminPanel}>
        <h2 className="text-base font-semibold">Журнал аудита</h2>
        <div className="mt-3 space-y-2">
          {(data?.auditEntries ?? []).map((entry) => (
            <div key={entry.id} className="rounded border border-border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{entry.boutId}</p>
                  <p className="text-muted">{entry.issueCode}</p>
                  <p>{entry.issueMessage}</p>
                  <p className="text-xs text-muted">{new Date(entry.detectedAt).toLocaleString('ru-RU')}</p>
                </div>
                {!entry.resolvedAt ? (
                  <Button variant="secondary" size="sm" onClick={() => void resolveEntry(entry.id)}>
                    Закрыть
                  </Button>
                ) : (
                  <p className="text-xs text-muted">Закрыто: {entry.resolutionNote}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={adminPanel}>
        <h2 className="text-base font-semibold">Коррекции результатов (audit trail)</h2>
        <div className="mt-3 space-y-2">
          {(data?.correctionCases ?? []).map((caseRow) => (
            <div key={caseRow.id} className="rounded border border-border p-3 text-sm">
              <p className="font-medium">{caseRow.sourceBoutId}</p>
              <p>{caseRow.reason}</p>
              <p className="text-xs text-muted">
                {caseRow.requestedBy} · {new Date(caseRow.createdAt).toLocaleString('ru-RU')} · {caseRow.status}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
