'use client'

import { Button } from '@/components/ui/Button'
import type { Corner } from '@/lib/bouts/mat-control/types'
import type { PenaltyLadder } from '@/lib/config/fseRules'

export function CornerOverflowMenu({
  corner,
  open,
  onClose,
  onDisqualify,
}: {
  corner: Corner
  open: boolean
  onClose: () => void
  onDisqualify: (ladder: PenaltyLadder) => void
}) {
  if (!open) return null

  const cornerLabel = corner === 'red' ? 'красного' : 'синего'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-xs rounded-xl border border-border bg-background p-2 shadow-xl">
        <p className="px-2 py-1 text-sm font-semibold text-foreground">
          Угол {cornerLabel}
        </p>
        <Button
          variant="secondary"
          className="mt-1 w-full justify-start"
          onClick={() => {
            onDisqualify('GENERAL')
            onClose()
          }}
        >
          Дисквалификация за нарушение
        </Button>
        <Button
          variant="secondary"
          className="mt-1 w-full justify-start"
          onClick={() => {
            onDisqualify('OUT_OF_BOUNDS')
            onClose()
          }}
        >
          Дисквалификация за выход
        </Button>
        <Button
          variant="secondary"
          className="mt-1 w-full justify-start"
          onClick={() => {
            onDisqualify('PASSIVITY')
            onClose()
          }}
        >
          Дисквалификация за пассивность
        </Button>
        <Button variant="secondary" className="mt-1 w-full justify-start" onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </div>
  )
}
