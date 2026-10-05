'use client'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { BRACKET_REDRAW_CONFIRM } from '@/lib/brackets/labels'

interface AdminBracketRedrawAllConfirmDialogProps {
  open: boolean
  categoryCount: number
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function AdminBracketRedrawAllConfirmDialog({
  open,
  categoryCount,
  busy,
  onCancel,
  onConfirm,
}: AdminBracketRedrawAllConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      layer="nested"
      size="md"
      intent="danger"
      ariaLabelledBy="bracket-redraw-all-confirm-title"
    >
      <h3 id="bracket-redraw-all-confirm-title" className="text-lg font-semibold">
        {BRACKET_REDRAW_CONFIRM.redrawAllForceTitle}
      </h3>
      <p className="mt-2 text-sm text-muted">{BRACKET_REDRAW_CONFIRM.redrawAllForceBody}</p>
      <p className="mt-2 text-sm font-medium">Категорий: {categoryCount}</p>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
        {BRACKET_REDRAW_CONFIRM.redrawAllBullets.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {BRACKET_REDRAW_CONFIRM.cancel}
        </Button>
        <Button disabled={busy || categoryCount === 0} onClick={onConfirm}>
          {BRACKET_REDRAW_CONFIRM.confirm}
        </Button>
      </div>
    </Modal>
  )
}
