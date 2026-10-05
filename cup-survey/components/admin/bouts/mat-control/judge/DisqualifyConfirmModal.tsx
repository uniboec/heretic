'use client'

import { Button } from '@/components/ui/Button'
import { oppositeCorner } from '@/lib/bouts/assertBoutParticipantCorner'
import type { Corner } from '@/lib/bouts/mat-control/types'
import type { PenaltyLadder } from '@/lib/config/fseRules'

import { BoutOutcomeConfirmSummary } from './BoutOutcomeConfirmSummary'

function ladderDescription(ladder: PenaltyLadder): string {
  if (ladder === 'GENERAL') {
    return 'Повторное нарушение правил — дисквалификация по общей лестнице штрафов.'
  }
  if (ladder === 'OUT_OF_BOUNDS') {
    return 'Повторный выход за пределы ковра — дисквалификация по лестнице «за ковёр».'
  }
  return 'Повторная пассивность — дисквалификация по лестнице пассивности.'
}

export function DisqualifyConfirmModal({
  open,
  busy,
  corner,
  ladder,
  penalizedName,
  winnerName,
  onClose,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  corner: Corner
  ladder: PenaltyLadder
  penalizedName: string
  winnerName: string
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Подтвердите дисквалификацию</h2>
        <p className="mt-2 text-sm leading-snug text-muted">{ladderDescription(ladder)}</p>

        <BoutOutcomeConfirmSummary
          winnerName={winnerName}
          winnerCorner={oppositeCorner(corner)}
          loserName={penalizedName}
          loserCorner={corner}
        />

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={busy} onClick={() => void onConfirm()}>
            Дисквалифицировать
          </Button>
        </div>
      </div>
    </div>
  )
}
