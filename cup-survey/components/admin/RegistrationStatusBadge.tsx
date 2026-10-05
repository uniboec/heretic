import type { RegistrationStatus } from '@/lib/registration/status'
import { getPublicStatusLabel } from '@/lib/registration/status'
import { StatusBadge, type StatusBadgeTone } from '@/components/ui/StatusBadge'

const toneByStatus: Partial<Record<RegistrationStatus, StatusBadgeTone>> = {
  PAID: 'success',
  PAYMENT_REVIEW: 'warning',
  PAYMENT_REJECTED: 'danger',
  CANCELLED: 'neutral',
}

export function RegistrationStatusBadge({ status }: { status: RegistrationStatus | string }) {
  const normalized = status as RegistrationStatus
  return (
    <StatusBadge tone={toneByStatus[normalized] ?? 'neutral'}>
      {getPublicStatusLabel(normalized)}
    </StatusBadge>
  )
}
