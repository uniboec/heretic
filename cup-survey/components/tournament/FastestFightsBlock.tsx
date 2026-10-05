'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import type { FastestFightsResponse } from '@/lib/fastestFights/types'
import { withBasePath } from '@/lib/basePath'
import { readPublicApiResponse } from '@/lib/tournament/readPublicApiResponse'
import { adminPanel } from '@/lib/ui/adminSurfaceStyles'
import { participantsTableUi } from '@/components/tournament/participantsUiClasses'

const copy = tournamentPageCopy.fastestFights
const POLL_INTERVAL_MS = 45_000

const fastestFightsTableUi = {
  table: cn(participantsTableUi.table, 'table-auto'),
  athleteTh: cn(participantsTableUi.th, 'min-w-[10rem]'),
  athleteTd: cn(participantsTableUi.td, 'min-w-[10rem] whitespace-normal'),
  clubTh: cn(participantsTableUi.th, 'min-w-[9rem]'),
  clubTd: cn(participantsTableUi.td, 'min-w-[9rem] whitespace-normal'),
  rankTh: cn(participantsTableUi.th, 'w-14 text-center'),
  rankTd: cn(participantsTableUi.td, 'w-14 text-center font-semibold tabular-nums'),
  timeTh: cn(participantsTableUi.th, 'w-20 text-center'),
  timeTd: cn(participantsTableUi.td, 'w-20 text-center font-semibold tabular-nums'),
  methodTh: cn(participantsTableUi.th, 'min-w-[9rem]'),
  methodTd: cn(participantsTableUi.td, 'min-w-[9rem] whitespace-normal'),
  categoryTh: cn(participantsTableUi.th, 'min-w-[10rem]'),
  categoryTd: cn(participantsTableUi.td, 'min-w-[10rem] whitespace-normal'),
}

function rankRowClass(rank: number): string {
  if (rank === 1) return 'bg-amber-50/80 hover:bg-amber-50'
  if (rank === 2) return 'bg-slate-50/90 hover:bg-slate-50'
  if (rank === 3) return 'bg-orange-50/70 hover:bg-orange-50'
  return participantsTableUi.rowHover
}

export function FastestFightsBlock() {
  const [data, setData] = useState<FastestFightsResponse | null>(null)
  const requestSeqRef = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    let pollTimer: number | undefined

    const load = async () => {
      const seq = ++requestSeqRef.current

      try {
        const response = await fetch(withBasePath('/api/tournament/fastest-fights'), {
          cache: 'no-store',
          signal: controller.signal,
        })
        const result = await readPublicApiResponse<FastestFightsResponse>(response)
        if (cancelled || seq !== requestSeqRef.current) return

        if (result.ok && result.data.published) {
          setData({
            published: true,
            publishedAt: result.data.publishedAt ?? null,
            rows: result.data.rows ?? [],
            totalEligible: result.data.totalEligible ?? 0,
          })
          return
        }

        setData(null)
      } catch {
        if (controller.signal.aborted || cancelled || seq !== requestSeqRef.current) return
        setData(null)
      }
    }

    void load()
    pollTimer = window.setInterval(() => {
      void load()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      controller.abort()
      if (pollTimer !== undefined) {
        window.clearInterval(pollTimer)
      }
    }
  }, [])

  if (!data?.rows.length) {
    return null
  }

  return (
    <section className={cn(adminPanel, 'overflow-hidden event-fastest-fights-block')}>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{copy.title}</h2>
        <p className="mt-1 text-xs text-muted">{copy.description}</p>
      </div>

      <div className="overflow-x-auto">
        <table className={fastestFightsTableUi.table}>
          <thead>
            <tr>
              <th className={fastestFightsTableUi.rankTh}>{copy.columns.rank}</th>
              <th className={fastestFightsTableUi.athleteTh}>{copy.columns.athlete}</th>
              <th className={fastestFightsTableUi.clubTh}>{copy.columns.club}</th>
              <th className={fastestFightsTableUi.timeTh}>{copy.columns.time}</th>
              <th className={fastestFightsTableUi.methodTh}>{copy.columns.method}</th>
              <th className={fastestFightsTableUi.categoryTh}>{copy.columns.category}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.boutId} className={rankRowClass(row.rank)}>
                <td className={fastestFightsTableUi.rankTd}>{row.rank}</td>
                <td className={fastestFightsTableUi.athleteTd}>
                  <span className="font-semibold text-foreground [overflow-wrap:anywhere]">
                    {row.displayName}
                  </span>
                </td>
                <td className={fastestFightsTableUi.clubTd}>
                  <div className="grid gap-0.5">
                    <span className="text-[0.8125rem] font-medium text-foreground [overflow-wrap:anywhere]">
                      {row.clubName || '—'}
                    </span>
                    {row.city ? (
                      <span className="text-xs text-muted [overflow-wrap:anywhere]">{row.city}</span>
                    ) : null}
                  </div>
                </td>
                <td className={fastestFightsTableUi.timeTd}>{row.timeLabel}</td>
                <td className={fastestFightsTableUi.methodTd}>{row.victoryMethodLabel}</td>
                <td className={fastestFightsTableUi.categoryTd}>
                  <span className="text-[0.8125rem] text-foreground [overflow-wrap:anywhere]">
                    {row.categoryTitle}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
