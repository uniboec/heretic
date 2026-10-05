'use client'

import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/cn'
import { adminBoutsIconBtn } from '@/lib/ui/adminSurfaceStyles'

export function AdminMandateCommentButton({
  athleteName,
  value,
  onSave,
}: {
  athleteName: string
  value: string
  onSave: (comment: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const hasComment = Boolean(value.trim())

  useEffect(() => {
    if (!open) setDraft(value)
  }, [open, value])

  const save = () => {
    onSave(draft)
    setOpen(false)
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          adminBoutsIconBtn,
          hasComment && 'text-accent hover:text-accent',
        )}
        aria-label={hasComment ? 'Редактировать комментарий' : 'Добавить комментарий'}
        title={hasComment ? value : 'Комментарий'}
        onClick={() => setOpen(true)}
      >
        <MessageSquare className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="md"
        ariaLabelledBy="mandate-comment-title"
      >
        <div className="p-5">
          <h2 id="mandate-comment-title" className="text-lg font-semibold text-foreground">
            Комментарий
          </h2>
          <p className="mt-1 text-sm text-muted">{athleteName}</p>
          <Textarea
            className="mt-4 min-h-[8rem]"
            value={draft}
            placeholder="Замечания комиссии"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={save}>
              Сохранить
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
