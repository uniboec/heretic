'use client'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

type AwardsBulkCompleteConfirmModalProps = {
  open: boolean
  categoryTitle: string
  pendingCount: number
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function AwardsBulkCompleteConfirmModal({
  open,
  categoryTitle,
  pendingCount,
  busy = false,
  onCancel,
  onConfirm,
}: AwardsBulkCompleteConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="md"
      intent="confirm"
      dismissible={!busy}
      ariaLabelledBy="awards-bulk-complete-title"
    >
      <h3 id="awards-bulk-complete-title" className="text-lg font-semibold">
        Подтвердить категорию?
      </h3>
      <p className="mt-2 text-sm text-muted">
        Категория «{categoryTitle}» будет завершена. Всем спортсменам без отметки будет проставлено
        «Медаль вручена».
      </p>
      {pendingCount > 0 ? (
        <p className="mt-2 text-sm font-medium text-foreground">
          Без отметки: {pendingCount}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          Отмена
        </Button>
        <Button disabled={busy} onClick={onConfirm}>
          {busy ? 'Сохранение…' : 'Подтвердить'}
        </Button>
      </div>
    </Modal>
  )
}
