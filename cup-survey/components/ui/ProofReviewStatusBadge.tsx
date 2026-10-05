import { StatusBadge } from '@/components/ui/StatusBadge'
import { getProofReviewStatusTone } from '@/lib/ui/entryPaymentStatusBadge'

interface ProofReviewStatusBadgeProps {
  status: string
  label: string
  className?: string
}

export function ProofReviewStatusBadge({ status, label, className }: ProofReviewStatusBadgeProps) {
  return (
    <StatusBadge tone={getProofReviewStatusTone(status)} className={className}>
      {label}
    </StatusBadge>
  )
}
