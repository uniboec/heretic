'use client'

import { Button } from '@/components/ui/Button'

export function ResetBoutConfirmModal({
  open,
  busy,
  scheduleDisplayNumber,
  onClose,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  scheduleDisplayNumber?: string | null
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  if (!open) return null

  const boutLabel = scheduleDisplayNumber
    ? `бой №${scheduleDisplayNumber}`
    : 'текущий поединок'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Сбросить поединок?</h2>
        <p className="mt-3 text-sm text-foreground">
          {boutLabel} вернётся в подготовку. Счёт, журнал и результат текущей попытки будут
          сброшены.
        </p>
        <p className="mt-2 text-sm text-muted">
          Если результат уже был подтверждён, он будет отменён. Следующие поединки по сетке тоже
          сбросятся, если они ещё не начались.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button
            className="border border-danger bg-danger text-white shadow-sm hover:bg-[#991b1b] hover:border-[#991b1b]"
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            Сбросить поединок
          </Button>
        </div>
      </div>
    </div>
  )
}
