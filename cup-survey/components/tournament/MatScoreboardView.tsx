'use client'

import { useCallback, useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import type { MatScoreboardSnapshot } from '@/lib/bouts/matScoreboardSnapshot'
import { useLivePeriodRemaining } from './useLivePeriodRemaining'
import {
  readCachedScoreboard,
  useScoreboardPwa,
  writeCachedScoreboard,
} from './useScoreboardPwa'

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case 'scheduled':
      return 'В очереди'
    case 'live':
      return 'Идёт'
    case 'pending_activity_decision':
      return 'Идёт'
    case 'pending_confirmation':
      return 'Идёт'
    case 'confirmed':
      return 'Завершён'
    default:
      return phase
  }
}

export function MatScoreboardView({ matIndex }: { matIndex: number }) {
  const [snapshot, setSnapshot] = useState<MatScoreboardSnapshot | null>(() =>
    readCachedScoreboard(matIndex),
  )
  const [error, setError] = useState<string | null>(null)
  const { offline } = useScoreboardPwa(matIndex)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(withBasePath(`/api/scoreboard/${matIndex}`), {
        cache: 'no-store',
      })
      const result = await readJsonResponse<MatScoreboardSnapshot>(response)
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? 'Ошибка загрузки')
      }
      setSnapshot(result.data)
      writeCachedScoreboard(matIndex, result.data)
      setError(null)
    } catch (refreshError) {
      const cached = readCachedScoreboard(matIndex)
      if (cached) {
        setSnapshot(cached)
        setError('Нет связи — показан последний сохранённый снимок табло')
        return
      }
      setError(refreshError instanceof Error ? refreshError.message : 'Ошибка загрузки')
    }
  }, [matIndex])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 5000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const active = snapshot?.activeBout
  const livePeriodRemainingMs = useLivePeriodRemaining(active)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-8">
        <header className="mb-6 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-muted">Табло ковра</p>
          <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Ковёр {matIndex}</h1>
          {offline ? (
            <p className="mt-2 text-sm font-medium text-amber-700">Offline — кэшированное табло</p>
          ) : null}
        </header>

        {error ? <p className="text-center text-amber-700">{error}</p> : null}

        {active ? (
          <section className="grid flex-1 gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
              <p className="text-sm font-semibold uppercase text-red-700">Красный</p>
              <p className="mt-2 text-2xl font-bold sm:text-3xl">{active.redName}</p>
              <p className="mt-6 text-6xl font-bold tabular-nums sm:text-7xl">{active.score.red}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted">Бой №{active.scheduleDisplayNumber}</p>
              <p className="mt-1 text-sm text-muted">{active.categoryTitle}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted">{active.discipline}</p>
              <p className="mt-6 text-5xl font-bold tabular-nums sm:text-6xl">
                {formatClock(livePeriodRemainingMs)}
              </p>
              <p className="mt-3 text-sm text-muted">
                {phaseLabel(active.boutPhase)} · {active.currentPeriod === 'extra' ? 'Доп. время' : 'Основное'}
                {active.clockRunning ? '' : ' · пауза'}
              </p>
              {active.pauseLabel ? (
                <p className="mt-2 text-sm font-semibold text-amber-700">● {active.pauseLabel}</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-6 text-center">
              <p className="text-sm font-semibold uppercase text-blue-700">Синий</p>
              <p className="mt-2 text-2xl font-bold sm:text-3xl">{active.blueName}</p>
              <p className="mt-6 text-6xl font-bold tabular-nums sm:text-7xl">{active.score.blue}</p>
            </div>
          </section>
        ) : (
          <section className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <div>
              <p className="text-xl font-semibold">Сейчас нет активного поединка</p>
              {snapshot?.nextBout ? (
                <p className="mt-3 text-muted">
                  Следующий: {snapshot.nextBout.redName} — {snapshot.nextBout.blueName}
                </p>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
