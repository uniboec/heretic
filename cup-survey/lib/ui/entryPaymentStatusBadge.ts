import type { StatusBadgeTone } from '@/components/ui/StatusBadge'
import type { EntryPaymentStatus } from '@/lib/registration/status'

export function getEntryPaymentStatusTone(
  status: EntryPaymentStatus | string,
  options: { publicFacing?: boolean } = {},
): StatusBadgeTone {
  const normalized = status as EntryPaymentStatus
  if (options.publicFacing) {
    if (normalized === 'PAID' || normalized === 'ADMITTED_WITHOUT_PAYMENT' || normalized === 'DEBT') {
      return 'success'
    }
    if (normalized === 'PAYMENT_REVIEW') return 'warning'
    return 'neutral'
  }

  switch (normalized) {
    case 'PAID':
      return 'success'
    case 'PAYMENT_REVIEW':
      return 'warning'
    case 'DEBT':
      return 'danger'
    case 'ADMITTED_WITHOUT_PAYMENT':
      return 'info'
    default:
      return 'neutral'
  }
}

export function getProofReviewStatusTone(status: string): StatusBadgeTone {
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'danger'
  return 'warning'
}
