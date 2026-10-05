'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import type { AdminBoutPanelOverview } from '@/lib/bouts/adminBoutPanel'
import { boutHasBothAthletes } from '@/lib/bouts/boutReadiness'
import { matControlHref } from '@/lib/bouts/matControlUrls'
import { formatMatControlPhase } from '@/lib/bouts/presentation/formatMatControlPhase'
import { CorrectBoutResultButton } from '@/components/admin/bouts/CorrectBoutResultButton'
import { OpenMatControlBoutLink } from '@/components/admin/bouts/OpenMatControlBoutLink'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { adminPanelHeader } from '@/lib/ui/adminSurfaceStyles'

export type AdminBracketBoutPanelTarget = {
  boutId: string
  matchLabel: string
  winnerEntryId?: string | null
  loserEntryId?: string | null
  sideALabel: string
  sideBLabel: string
  sidesReady: boolean
}

function formatScoreLine(panel: AdminBoutPanelOverview): string | null {
  if (!panel.score) return null
  const main = `${panel.score.red}:${panel.score.blue}`
  if (panel.score.extraRed != null && panel.score.extraBlue != null) {
    return `${main} · доп. ${panel.score.extraRed}:${panel.score.extraBlue}`
  }
  return main
}

export function AdminBracketBoutPanelModal({
  open,
  target,
  boutsReleased,
  onClose,
}: {
  open: boolean
  target: AdminBracketBoutPanelTarget | null
  boutsReleased: boolean
  onClose: () => void
}) {
  const [panel, setPanel] = useState<AdminBoutPanelOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !target || !boutsReleased) {
      setPanel(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setPanel(null)

    void fetch(withBasePath(`/api/admin/bouts/${encodeURIComponent(target.boutId)}/panel`), {
      cache: 'no-store',
    })
      .then((response) => readJsonResponse<{ panel: AdminBoutPanelOverview }>(response))
      .then((result) => {
        if (cancelled) return
        if (result.ok && result.data?.panel) {
          setPanel(result.data.panel)
          return
        }
        setError(result.ok ? 'Не удалось загрузить поединок' : result.error)
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить поединок')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, target, boutsReleased])

  if (!target) return null

  const sidesReady = panel
    ? boutHasBothAthletes(panel.sideA, panel.sideB)
    : target.sidesReady

  const showCorrection = panel?.displayStatus === 'completed' && panel.canCorrectResult && sidesReady
  const statusLabel = panel
    ? formatMatControlPhase(panel.boutPhase)
    : boutsReleased
      ? 'Загрузка…'
      : 'Не в расписании'

  return (
    <Modal open={open} onClose={onClose} size="lg" panelClassName="max-w-2xl" ariaLabelledBy="admin-bracket-bout-title">
      <div className="max-h-[min(85vh,40rem)] overflow-y-auto p-4 sm:p-5">
        <div className={cn(adminPanelHeader, 'mb-4 flex-wrap gap-3 border-b border-border pb-4')}>
          <div className="min-w-0 flex-1">
            <h2 id="admin-bracket-bout-title" className="text-base font-semibold text-foreground">
              {target.matchLabel}
            </h2>
            {panel?.categoryTitle ? (
              <p className="mt-1 text-xs text-muted">{panel.categoryTitle}</p>
            ) : null}
            <p className="mt-1 text-xs font-medium text-foreground">{statusLabel}</p>
          </div>
          <Button type="button" variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface/70 p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div className="text-sm">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">Красный</p>
                <p className="mt-1 font-semibold text-foreground">
                  {panel?.sideA.kind === 'athlete'
                    ? panel.sideA.displayName
                    : panel?.sideA.kind === 'hint'
                      ? panel.sideA.label
                      : target.sideALabel}
                </p>
              </div>
              <div className="text-center text-lg font-extrabold tabular-nums text-muted">VS</div>
              <div className="text-sm sm:text-right">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">Синий</p>
                <p className="mt-1 font-semibold text-foreground">
                  {panel?.sideB.kind === 'athlete'
                    ? panel.sideB.displayName
                    : panel?.sideB.kind === 'hint'
                      ? panel.sideB.label
                      : target.sideBLabel}
                </p>
              </div>
            </div>

            {panel?.confirmationSummary ? (
              <div className="mt-4 border-t border-border/90 pt-3 text-sm">
                <p className="font-semibold text-foreground">
                  Победитель: {panel.confirmationSummary.winnerLabel}
                </p>
                <p className="mt-1 text-muted">
                  {panel.confirmationSummary.victoryMethodLabel}
                  {formatScoreLine(panel) ? ` · ${formatScoreLine(panel)}` : ''}
                </p>
              </div>
            ) : target.winnerEntryId ? (
              <p className="mt-4 border-t border-border/90 pt-3 text-sm text-muted">
                В сетке зафиксирован результат. Подробности появятся после проведения поединка на ковре.
              </p>
            ) : null}
          </div>

          {!boutsReleased ? (
            <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
              Поединки категории ещё не выпущены в расписание. Сначала опубликуйте сетку и выпустите бои.
            </p>
          ) : loading ? (
            <p className="text-sm text-muted">Загрузка хода поединка…</p>
          ) : error ? (
            <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-danger-foreground">
              {error}
            </p>
          ) : panel ? (
            <>
              {panel.timeline.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Ход поединка</h3>
                  <ul className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border bg-card p-3">
                    {panel.timeline.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
                      >
                        <span className="font-bold tabular-nums text-foreground">{entry.headline}</span>
                        <span className="text-muted">{entry.subtitle}</span>
                        <span className="ml-auto text-xs tabular-nums text-muted">{entry.boutTime}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  Событий на ковре пока нет. Откройте панель управления, чтобы провести поединок.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                {showCorrection ? (
                  <CorrectBoutResultButton
                    matIndex={panel.matIndex}
                    boutId={panel.boutId}
                    sideA={panel.sideA}
                    sideB={panel.sideB}
                    compact={false}
                  />
                ) : sidesReady ? (
                  <OpenMatControlBoutLink
                    matIndex={panel.matIndex}
                    boutId={panel.boutId}
                    sideA={panel.sideA}
                    sideB={panel.sideB}
                    compact={false}
                  />
                ) : null}
                {panel && sidesReady ? (
                  <Link
                    href={matControlHref(panel.matIndex, {
                      boutId: panel.boutId,
                      editResult: panel.displayStatus === 'completed',
                    })}
                    className="text-sm font-semibold text-accent hover:underline"
                  >
                    Открыть панель управления
                  </Link>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
