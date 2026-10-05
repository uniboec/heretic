'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'

type AwardsCommentsModalProps = {
  open: boolean
  title: string
  subtitle?: string
  adminComment: string
  publicComment: string
  saving?: boolean
  onClose: () => void
  onSave: (adminComment: string, publicComment: string) => void | Promise<void>
}

export function AwardsCommentsModal({
  open,
  title,
  subtitle,
  adminComment,
  publicComment,
  saving = false,
  onClose,
  onSave,
}: AwardsCommentsModalProps) {
  const [adminDraft, setAdminDraft] = useState(adminComment)
  const [publicDraft, setPublicDraft] = useState(publicComment)

  useEffect(() => {
    if (!open) return
    setAdminDraft(adminComment)
    setPublicDraft(publicComment)
  }, [adminComment, open, publicComment])

  return (
    <Modal open={open} onClose={onClose} size="md" ariaLabelledBy="awards-comments-title">
      <div className="p-4 sm:p-5">
        <div className="mb-3">
          <h2 id="awards-comments-title" className="text-sm font-semibold text-foreground">
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>

        <div className="space-y-2.5">
          <label className="block text-sm">
            <span className="mb-1 block text-[0.6875rem] font-medium text-muted">
              Внутренний
            </span>
            <Textarea
              rows={2}
              value={adminDraft}
              onChange={(event) => setAdminDraft(event.target.value)}
              placeholder="Только для организаторов"
              className="min-h-[4rem] text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[0.6875rem] font-medium text-muted">
              Публичный
            </span>
            <Textarea
              rows={2}
              value={publicDraft}
              onChange={(event) => setPublicDraft(event.target.value)}
              placeholder="Виден на публичной странице"
              className="min-h-[4rem] text-sm"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void onSave(adminDraft, publicDraft)}
          >
            Сохранить
          </Button>
        </div>
      </div>
    </Modal>
  )
}
