'use client'

import { Modal, modalContentEnter } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { RegistrationUnlockForm } from '@/components/registration/RegistrationUnlockForm'
import { tournamentPageCopy } from '@/lib/content/tournament-page'

const copy = tournamentPageCopy.participants.edit

interface Props {
  open: boolean
  athleteName: string
  clubName: string
  entryId: string | null
  onClose: () => void
}

export function ParticipantEditUnlockModal({
  open,
  athleteName,
  clubName,
  entryId,
  onClose,
}: Props) {
  if (!entryId) return null

  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabelledBy="participant-edit-title">
      <div className={cn(modalContentEnter, 'p-5 sm:p-6')}>
        <p className="mb-4 text-sm text-[var(--color-foreground)]">
          <span className="font-semibold">{athleteName}</span>
          <span className="text-[var(--color-muted)]"> · {clubName}</span>
        </p>
        <RegistrationUnlockForm
          embedded
          entryId={entryId}
          titleId="participant-edit-title"
          title={copy.title}
          description={copy.description}
          submitLabel={copy.submit}
          onSuccess={onClose}
        />
      </div>
    </Modal>
  )
}
