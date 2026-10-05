'use client'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { BRACKET_SYNC_CONFIRM } from '@/lib/brackets/labels'

interface AdminBracketSyncConfirmDialogProps {
  open: boolean
  scope: 'all' | 'category'
  busy: boolean
  canConfirmCategory: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function AdminBracketSyncConfirmDialog({
  open,
  scope,
  busy,
  canConfirmCategory,
  onCancel,
  onConfirm,
}: AdminBracketSyncConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      layer="nested"
      size="md"
      intent="confirm"
      ariaLabelledBy="bracket-sync-confirm-title"
    >
      <h3 id="bracket-sync-confirm-title" className="text-lg font-semibold">
        {scope === 'all'
          ? BRACKET_SYNC_CONFIRM.syncAllTitle
          : BRACKET_SYNC_CONFIRM.syncCategoryTitle}
      </h3>
      <p className="mt-2 text-sm text-muted">
        {scope === 'all'
          ? BRACKET_SYNC_CONFIRM.syncAllBody
          : BRACKET_SYNC_CONFIRM.syncCategoryBody}
      </p>
      {scope === 'all' && (
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
          {BRACKET_SYNC_CONFIRM.syncAllBullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          {BRACKET_SYNC_CONFIRM.cancel}
        </Button>
        <Button
          disabled={busy || (scope === 'category' && !canConfirmCategory)}
          onClick={onConfirm}
        >
          {BRACKET_SYNC_CONFIRM.confirm}
        </Button>
      </div>
    </Modal>
  )
}
