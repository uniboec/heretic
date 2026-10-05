'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { tournamentPageCopy } from '@/lib/content/tournament-page'
import type { AthleteRatingPublicResponse, AthleteRatingPublicRow } from '@/lib/athleteRatings/types'
import type { AthleteRatingView } from '@/lib/athleteRatings/constants'
import { withBasePath } from '@/lib/basePath'
import { readPublicApiResponse } from '@/lib/tournament/readPublicApiResponse'
import { adminPanel } from '@/lib/ui/adminSurfaceStyles'
import { awardsPublicTab, awardsPublicTabs } from '@/lib/ui/awardsUiClasses'
import { AthleteRatingAthleteCell } from '@/components/tournament/AthleteRatingAthleteCell'
import { AthleteRatingFormulaModal } from '@/components/tournament/AthleteRatingFormulaModal'
import { athleteRatingsPublicTableUi } from '@/components/tournament/athleteRatingsTableUi'
import { participantsTableUi } from '@/components/tournament/participantsUiClasses'

const copy = tournamentPageCopy.athleteRatings
const POLL_INTERVAL_MS = 45_000

const viewOptions: Array<{ id: AthleteRatingView; label: string }> = [
  { id: 'overall', label: copy.overall },
  { id: 'tactic_control', label: copy.tacticControl },
  { id: 'close_control', label: copy.closeControl },
]

export function AthleteRatingBlock() {
  const [view, setView] = useState<AthleteRatingView>('overall')
  const [data, setData] = useState<AthleteRatingPublicResponse | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'disabled' | 'error'>('loading')
  const [helpOpen, setHelpOpen] = useState(false)
  const requestSeqRef = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    let pollTimer: number | undefined

    const load = async () => {
      const seq = ++requestSeqRef.current
      try {
        const response = await fetch(
          withBasePath(`/api/tournament/athlete-ratings?discipline=${view}`),
          { cache: 'no-store', signal: controller.signal },
        )
        const result = await readPublicApiResponse<AthleteRatingPublicResponse>(response)
        if (cancelled || seq !== requestSeqRef.current) return

        if (result.ok) {
          setData(result.data)
          setState('ready')
          return
        }
        if (result.kind === 'disabled') {
          setState('disabled')
          setData(null)
          return
        }
        setState('error')
      } catch {
        if (!controller.signal.aborted && !cancelled) {
          setState('error')
        }
      }
    }

    setState('loading')
    void load()
    pollTimer = window.setInterval(() => void load(), POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      controller.abort()
      if (pollTimer !== undefined) window.clearInterval(pollTimer)
    }
  }, [view])

  const rows = useMemo(() => data?.rows ?? [], [data])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={awardsPublicTabs}>
          {viewOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={awardsPublicTab(view === option.id)}
              onClick={() => setView(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => setHelpOpen(true)}
        >
          {copy.howItWorksTitle}
        </button>
      </div>

      <AthleteRatingFormulaModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        formula={data?.formula ?? null}
        topLimit={data?.topLimit ?? 10}
        loading={state === 'loading'}
      />

      {state === 'loading' ? (
        <div className={`${adminPanel} p-8 text-center text-sm text-muted`}>{copy.loading}</div>
      ) : null}

      {state === 'disabled' ? (
        <div className={`${adminPanel} p-8 text-center text-sm text-muted`}>{copy.disabled}</div>
      ) : null}

      {state === 'error' ? (
        <div className={`${adminPanel} p-8 text-center text-sm text-muted`}>{copy.loadError}</div>
      ) : null}

      {state === 'ready' && rows.length === 0 ? (
        <div className={`${adminPanel} p-8 text-center text-sm text-muted`}>{copy.empty}</div>
      ) : null}

      {state === 'ready' && rows.length > 0 ? (
        <div className={cn(adminPanel, 'overflow-hidden p-0')}>
          <div className={athleteRatingsPublicTableUi.wrap}>
            <table className={athleteRatingsPublicTableUi.table}>
              <thead>
                <tr>
                  <th className={athleteRatingsPublicTableUi.rankTh}>{copy.columns.rank}</th>
                  <th className={athleteRatingsPublicTableUi.athleteTh}>{copy.columns.athlete}</th>
                  <th className={athleteRatingsPublicTableUi.ageTh}>{copy.columns.age}</th>
                  <th className={athleteRatingsPublicTableUi.resultTh}>{copy.columns.result}</th>
                  <th className={athleteRatingsPublicTableUi.winsTh}>{copy.columns.wins}</th>
                  <th className={athleteRatingsPublicTableUi.pointsTh}>{copy.columns.points}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: AthleteRatingPublicRow) => (
                  <tr key={row.athleteId} className={participantsTableUi.rowHover}>
                    <td className={athleteRatingsPublicTableUi.rankTd}>{row.rank}</td>
                    <td className={athleteRatingsPublicTableUi.athleteTd}>
                      <AthleteRatingAthleteCell
                        displayName={row.displayName}
                        clubName={row.clubName}
                        city={row.city}
                      />
                    </td>
                    <td className={athleteRatingsPublicTableUi.ageTd}>{row.ageLabel}</td>
                    <td className={athleteRatingsPublicTableUi.resultTd}>{row.resultsSummary}</td>
                    <td className={athleteRatingsPublicTableUi.winsTd}>{row.wins}</td>
                    <td className={athleteRatingsPublicTableUi.pointsTd}>{row.ratingFormatted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
