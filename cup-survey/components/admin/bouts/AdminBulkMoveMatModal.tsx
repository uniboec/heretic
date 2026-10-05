'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

export function AdminBulkMoveMatModal({
  open,
  busy,
  selectedCount,
  targetMats,
  onClose,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  selectedCount: number
  targetMats: number[]
  onClose: () => void
  onConfirm: (targetMatIndex: number) => Promise<void>
}) {
  const [targetMatIndex, setTargetMatIndex] = useState<number | null>(null)

  useEffect(() => {
    if (open) {
      setTargetMatIndex(targetMats[0] ?? null)
    }
  }, [open, targetMats])

  if (!open || targetMats.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Перенести на другой ковёр</h2>
        <p className="mt-2 text-sm text-muted">
          Выбрано поединков: {selectedCount}. Они встанут в очередь выбранного ковра по его правилам
          этапов и сортировки.
        </p>
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
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={busy || targetMatIndex == null}
            onClick={() => targetMatIndex != null && void onConfirm(targetMatIndex)}
          >
            Перенести
          </Button>
        </div>
      </div>
    </div>
  )
}
