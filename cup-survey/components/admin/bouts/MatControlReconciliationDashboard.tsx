'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { routes } from '@/lib/routes'
import { Button } from '@/components/ui/Button'
import { adminPanel } from '@/lib/ui/adminSurfaceStyles'

type RatingBracketMismatch = {
  boutId: string
  categoryKey: string
  systemId: string
  winnerEntryId: string | null
  bracketWinnerEntryId: string | null
  victoryMethod: string | null
  fightOfficiallyStarted: boolean | null
}

type BackfillUpdate = {
  boutId: string
  from: boolean | null
  to: boolean
}

type FastestFightEligibilityGap = {
  boutId: string
  victoryMethod: string
  boutElapsedMs: number | null
  fightOfficiallyStarted: boolean
  reason: string
}

export function MatControlReconciliationDashboard() {
  const [mismatches, setMismatches] = useState<RatingBracketMismatch[]>([])
  const [fastestFightGaps, setFastestFightGaps] = useState<FastestFightEligibilityGap[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [backfillDryRun, setBackfillDryRun] = useState<BackfillUpdate[] | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const query = categoryFilter.trim()
      ? `?categoryKey=${encodeURIComponent(categoryFilter.trim())}`
      : ''
    const res = await fetch(withBasePath(`/api/admin/bouts/reconciliation${query}`))
    const result = await readJsonResponse<{
      mismatches: RatingBracketMismatch[]
      fastestFightGaps: FastestFightEligibilityGap[]
    }>(res)
    if (!result.ok) {
      setError(result.error ?? 'Не удалось загрузить сверку')
      return
    }
    setMismatches(result.data?.mismatches ?? [])
    setFastestFightGaps(result.data?.fastestFightGaps ?? [])
  }, [categoryFilter])

  useEffect(() => {
    void load()
  }, [load])

  const runBackfill = async (dryRun: boolean, boutId?: string) => {
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch(withBasePath('/api/admin/bouts/reconciliation'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'backfill-fight-officially-started',
          dryRun,
          boutId,
        }),
      })
      const result = await readJsonResponse<{ updated: number; updates: BackfillUpdate[] }>(res)
      if (!result.ok) {
        setError(result.error ?? 'Backfill не выполнен')
        return
      }
      if (dryRun) {
        setBackfillDryRun(result.data?.updates ?? [])
        setMessage(`Dry-run: ${result.data?.updated ?? 0} записей требуют обновления`)
      } else {
        setBackfillDryRun(null)
        setMessage(`Обновлено записей: ${result.data?.updated ?? 0}`)
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={adminPanel}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Сверка mat-control</h1>
          <p className="text-sm text-muted">
            Расхождения между результатами боёв и сеткой, backfill fightOfficiallyStarted.
          </p>
        </div>
        <Link href={withBasePath(routes.admin.bouts)}>
          <Button variant="secondary">К поединкам</Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Фильтр categoryKey</span>
          <input
            className="rounded-md border border-border px-3 py-2"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            placeholder="например m-70-kg"
          />
        </label>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void load()}>
          Обновить
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void runBackfill(true)}>
          Dry-run backfill
        </Button>
        <Button type="button" disabled={busy} onClick={() => void runBackfill(false)}>
          Применить backfill
        </Button>
      </div>

      {message ? <p className="mb-3 text-sm text-success">{message}</p> : null}
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold">
          Расхождения результат / сетка ({mismatches.length})
        </h2>
        {mismatches.length === 0 ? (
          <p className="text-sm text-muted">Расхождений не найдено.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2">Bout</th>
                  <th className="px-3 py-2">Категория</th>
                  <th className="px-3 py-2">Победитель (результат)</th>
                  <th className="px-3 py-2">Победитель (сетка)</th>
                  <th className="px-3 py-2">Метод</th>
                  <th className="px-3 py-2">fightOfficiallyStarted</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {mismatches.map((row) => (
                  <tr key={row.boutId} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{row.boutId}</td>
                    <td className="px-3 py-2">{row.categoryKey}</td>
                    <td className="px-3 py-2">{row.winnerEntryId ?? '—'}</td>
                    <td className="px-3 py-2">{row.bracketWinnerEntryId ?? '—'}</td>
                    <td className="px-3 py-2">{row.victoryMethod ?? '—'}</td>
                    <td className="px-3 py-2">
                      {row.fightOfficiallyStarted == null ? '—' : row.fightOfficiallyStarted ? 'да' : 'нет'}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void runBackfill(false, row.boutId)}
                      >
                        Backfill eligibility
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold">
          Fastest fights — eligibility gaps ({fastestFightGaps.length})
        </h2>
        {fastestFightGaps.length === 0 ? (
          <p className="text-sm text-muted">Боёв с методом SUBMISSION/CHOKE/CLEAR_ADVANTAGE вне рейтинга не найдено.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2">Bout</th>
                  <th className="px-3 py-2">Метод</th>
                  <th className="px-3 py-2">Время (мс)</th>
                  <th className="px-3 py-2">fightOfficiallyStarted</th>
                  <th className="px-3 py-2">Причина</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {fastestFightGaps.map((row) => (
                  <tr key={row.boutId} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{row.boutId}</td>
                    <td className="px-3 py-2">{row.victoryMethod}</td>
                    <td className="px-3 py-2">{row.boutElapsedMs ?? '—'}</td>
                    <td className="px-3 py-2">{row.fightOfficiallyStarted ? 'да' : 'нет'}</td>
                    <td className="px-3 py-2">{row.reason}</td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void runBackfill(false, row.boutId)}
                      >
                        Backfill
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {backfillDryRun && backfillDryRun.length > 0 ? (
        <section>
          <h2 className="mb-3 text-base font-semibold">Dry-run backfill ({backfillDryRun.length})</h2>
          <ul className="space-y-1 text-sm font-mono">
            {backfillDryRun.map((row) => (
              <li key={row.boutId}>
                {row.boutId}: {String(row.from)} → {String(row.to)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
