'use client'

import { Button } from '@/components/ui/Button'
import { formatMatControlEvent } from '@/lib/bouts/presentation/formatMatControlEvent'
import type { BoutEventRecord } from '@/lib/bouts/mat-control/types'

export function JudgeTechnicalJournalDrawer({
  open,
  events,
  onClose,
}: {
  open: boolean
  events: BoutEventRecord[]
  onClose: () => void
}) {
  if (!open) return null

  const visible = [...events].reverse().filter((event) => !event.undoneAt)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="h-full w-full max-w-md overflow-y-auto bg-background p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Технический журнал</h3>
          <Button variant="secondary" onClick={onClose}>Закрыть</Button>
        </div>
        <ul className="mt-4 space-y-2 text-sm">
          {visible.length === 0 ? (
            <li className="text-muted">Событий пока нет</li>
          ) : (
            visible.map((event) => (
              <li key={event.id} className="rounded border border-border px-3 py-2">
                <p className="font-medium text-foreground">{formatMatControlEvent(event)}</p>
                <p className="mt-1 text-xs text-muted">
                  #{event.sequence} · {event.eventType}
                  {event.period ? ` · ${event.period}` : ''}
                </p>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
