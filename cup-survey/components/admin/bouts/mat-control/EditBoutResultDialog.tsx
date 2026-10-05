'use client'

import { useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { Button } from '@/components/ui/Button'
import { BOUT_RESULT_CORRECTION_DIALOG_NOTE } from '@/lib/bouts/boutResultCorrectionCopy'
import { ViewBracketCategoryButton } from '@/components/tournament/brackets/ViewBracketCategoryButton'

interface EditBoutResultDialogProps {
  open: boolean
  boutId: string
  categoryKey: string
  systemId: string
  schedulePhase: 'elimination' | 'bronze' | 'final' | 'round_robin'
  redEntryId: string | null
  blueEntryId: string | null
  currentWinnerEntryId: string | null
  downstreamBoutIds: string[]
  onClose: () => void
  onApplied: () => void
}

export function EditBoutResultDialog({
  open,
  boutId,
  categoryKey,
  systemId,
  schedulePhase,
  redEntryId,
  blueEntryId,
  currentWinnerEntryId,
  downstreamBoutIds,
  onClose,
  onApplied,
}: EditBoutResultDialogProps) {
  const [winnerEntryId, setWinnerEntryId] = useState(currentWinnerEntryId ?? '')
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<{
    correctionMode?: string
    warning?: string
    blocked?: boolean
    blockingBoutIds?: string[]
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function loadPreview() {
    const params = new URLSearchParams({
      newWinnerEntryId: winnerEntryId,
      systemId,
      categoryKey,
    })
    for (const id of downstreamBoutIds) {
      params.append('downstreamBoutId', id)
    }
    const res = await fetch(
      withBasePath(`/api/admin/bouts/${boutId}/result-correction/preview?${params.toString()}`),
    )
    const result = await readJsonResponse(res)
    if (!result.ok) {
      setError(result.error ?? 'Не удалось получить preview')
      return
    }
    setPreview(result.data as typeof preview)
  }

  async function applyCorrection() {
    setBusy(true)
    setError(null)
    const loserEntryId =
      winnerEntryId === redEntryId
        ? blueEntryId
        : winnerEntryId === blueEntryId
          ? redEntryId
          : null

    const res = await fetch(withBasePath(`/api/admin/bouts/${boutId}/result-correction/apply`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId: crypto.randomUUID(),
        reason,
        requestedBy: 'admin',
        newWinnerEntryId: winnerEntryId || null,
        newLoserEntryId: loserEntryId,
        systemId,
        categoryKey,
        schedulePhase,
        downstreamBoutIds,
      }),
    })
    const result = await readJsonResponse(res)
    setBusy(false)
    if (!result.ok) {
      setError(result.error ?? 'Не удалось применить коррекцию')
      return
    }
    onApplied()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Изменить результат</h2>
          <ViewBracketCategoryButton categoryKey={categoryKey} variant="admin" />
        </div>
        <p className="mt-3 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm leading-relaxed text-warning-foreground">
          {BOUT_RESULT_CORRECTION_DIALOG_NOTE}
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-muted">Победитель</span>
            <select
              className="mt-1 w-full rounded-md border border-border px-3 py-2"
              value={winnerEntryId}
              onChange={(event) => setWinnerEntryId(event.target.value)}
            >
              <option value="">—</option>
              {redEntryId ? <option value={redEntryId}>Красный</option> : null}
              {blueEntryId ? <option value={blueEntryId}>Синий</option> : null}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted">Причина</span>
            <textarea
              className="mt-1 w-full rounded-md border border-border px-3 py-2"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </div>

        {preview ? (
          <div className="mt-3 rounded-md border border-border bg-muted/20 p-3 text-sm">
            <p>Режим: {preview.correctionMode}</p>
            {preview.warning ? <p className="mt-1 text-amber-700">{preview.warning}</p> : null}
            {preview.blocked ? (
              <p className="mt-1 text-destructive">
                Заблокировано: {preview.blockingBoutIds?.join(', ')}
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void loadPreview()}>
            Preview
          </Button>
          <Button type="button" disabled={busy || !reason} onClick={() => void applyCorrection()}>
            Применить
          </Button>
        </div>
      </div>
    </div>
  )
}
