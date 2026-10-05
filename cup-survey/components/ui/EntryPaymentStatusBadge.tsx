import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'
import {
  getEntryPaymentStatusLabel,
  getParticipantListStatusLabel,
  type EntryPaymentStatus,
} from '@/lib/registration/status'
import { getEntryPaymentStatusTone } from '@/lib/ui/entryPaymentStatusBadge'

interface EntryPaymentStatusBadgeProps {
  status: EntryPaymentStatus | string
  className?: string
  /** Public list collapses admitted/debt into “paid”. */
  publicFacing?: boolean
  label?: string
}

export function EntryPaymentStatusBadge({
  status,
  className,
  publicFacing = false,
  label,
}: EntryPaymentStatusBadgeProps) {
  const normalized = status as EntryPaymentStatus
  const text =
    label ??
    (publicFacing
      ? getParticipantListStatusLabel(normalized)
      : getEntryPaymentStatusLabel(normalized))

  return (
    <StatusBadge
      tone={getEntryPaymentStatusTone(normalized, { publicFacing })}
      appearance="event"
      className={className}
    >
      {text}
    </StatusBadge>
  )
}
