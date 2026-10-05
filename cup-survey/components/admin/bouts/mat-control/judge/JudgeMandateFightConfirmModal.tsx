'use client'

import { Button } from '@/components/ui/Button'
import { buildMandateCommissionAthleteUrl } from '@/lib/mandate/mandateCommissionUrl'
import type { BoutMandateWarningAthlete } from '@/lib/mandate/boutMandateWarnings'

function cornerLabel(corner: 'red' | 'blue'): string {
  return corner === 'red' ? 'Красный' : 'Синий'
}

export function JudgeMandateFightConfirmModal({
  open,
  athletes,
  onCancel,
  onConfirm,
}: {
  open: boolean
  athletes: BoutMandateWarningAthlete[]
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Подтвердите старт поединка</h2>
        <p className="mt-2 text-sm leading-snug text-muted">
          У спортсменов есть замечания мандатной комиссии. Подтверждаете, что допускаете их к
          поединку несмотря на следующие проблемы:
        </p>

        <ul className="mt-4 space-y-3">
          {athletes.map((athlete) => (
            <li key={athlete.entryId} className="rounded-lg border border-border bg-surface/60 px-3 py-2.5">
              <p className="text-sm font-semibold text-foreground">
                {cornerLabel(athlete.corner)} · {athlete.name}
              </p>
              <ul className="mt-2 space-y-1.5">
                {athlete.warnings.map((warning) => (
                  <li
                    key={`${athlete.entryId}-${warning.code}`}
                    className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-sm"
                  >
                    <span className="text-foreground">{warning.message}</span>
                    {athlete.athleteId ? (
                      <a
                        href={buildMandateCommissionAthleteUrl(athlete.athleteId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-xs font-semibold text-accent underline-offset-2 hover:underline"
                      >
                        Допуск
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
          <Button onClick={onConfirm}>Запустить поединок</Button>
        </div>
      </div>
    </div>
  )
}
