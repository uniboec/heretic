'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatPostponeSkipLabel } from '@/lib/bouts/resolvePostponeAnchor'

type TransferMode = 'skip' | 'mat'

export function PostponeBoutModal({
  open,
  busy,
  scheduleDisplayNumber,
  maxSkip,
  targetMats,
  cascadeCount,
  onClose,
  onConfirmSkip,
  onConfirmMoveMat,
}: {
  open: boolean
  busy: boolean
  scheduleDisplayNumber?: string | null
  maxSkip: number
  targetMats: number[]
  cascadeCount: number
  onClose: () => void
  onConfirmSkip: (postponeBy: number) => Promise<void>
  onConfirmMoveMat: (targetMatIndex: number) => Promise<void>
}) {
  const [mode, setMode] = useState<TransferMode>('skip')
  const [postponeBy, setPostponeBy] = useState(1)
  const [targetMatIndex, setTargetMatIndex] = useState<number | null>(null)

  const canSkip = maxSkip > 0
  const canMoveMat = targetMats.length > 0

  useEffect(() => {
    if (!open) return
    setPostponeBy(1)
    setTargetMatIndex(targetMats[0] ?? null)
    if (canSkip) {
      setMode('skip')
    } else if (canMoveMat) {
      setMode('mat')
    }
  }, [open, canSkip, canMoveMat, targetMats])

  if (!open || (!canSkip && !canMoveMat)) return null

  const boutLabel = scheduleDisplayNumber
    ? `бой №${scheduleDisplayNumber}`
    : 'текущий поединок'

  const handleConfirm = async () => {
    if (mode === 'skip') {
      await onConfirmSkip(postponeBy)
      return
    }
    if (targetMatIndex == null) return
    await onConfirmMoveMat(targetMatIndex)
  }

  const confirmDisabled =
    busy ||
    (mode === 'skip' && !canSkip) ||
    (mode === 'mat' && (targetMatIndex == null || !canMoveMat))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Перенести поединок</h2>
        <p className="mt-2 text-sm text-muted">
          {boutLabel} можно перенести в очереди или на другой ковёр.
        </p>
        {cascadeCount > 1 ? (
          <p className="mt-2 text-sm text-muted">
            Вместе с ним будут перенесены ещё {cascadeCount - 1} зависимых поединков.
          </p>
        ) : null}

        <div className="mt-4 space-y-2">
          {canSkip ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2">
              <input
                type="radio"
                name="transfer-mode"
                className="mt-1"
                checked={mode === 'skip'}
                disabled={busy}
                onChange={() => setMode('skip')}
              />
              <span className="text-sm text-foreground">Позже в очереди этого ковра</span>
            </label>
          ) : null}
          {canMoveMat ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2">
              <input
                type="radio"
                name="transfer-mode"
                className="mt-1"
                checked={mode === 'mat'}
                disabled={busy}
                onChange={() => setMode('mat')}
              />
              <span className="text-sm text-foreground">На другой ковёр</span>
            </label>
          ) : null}
        </div>

        {mode === 'skip' && canSkip ? (
          <label className="mt-4 block text-sm font-medium text-foreground">
            Через сколько поединков?
            <select
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={postponeBy}
              disabled={busy}
              onChange={(event) => setPostponeBy(Number(event.target.value))}
            >
              {Array.from({ length: maxSkip }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {formatPostponeSkipLabel(value)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {mode === 'mat' && canMoveMat ? (
          <label className="mt-4 block text-sm font-medium text-foreground">
            На какой ковёр?
            <select
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={targetMatIndex ?? ''}
              disabled={busy}
              onChange={(event) => setTargetMatIndex(Number(event.target.value))}
            >
              {targetMats.map((matIndex) => (
                <option key={matIndex} value={matIndex}>
                  Ковёр {matIndex}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-xs font-normal text-muted">
              Поединок встанет в очередь выбранного ковра по его правилам этапов и сортировки.
            </span>
          </label>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={confirmDisabled} onClick={() => void handleConfirm()}>
            Перенести
          </Button>
        </div>
      </div>
    </div>
  )
}
