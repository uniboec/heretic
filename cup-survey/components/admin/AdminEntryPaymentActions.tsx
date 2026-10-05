'use client'

import { AdminEntryPaymentStatusControl } from './AdminEntryPaymentStatusControl'

interface EntryLike {
  id: string
  paymentStatus: string
  paymentStatusLabel: string
  graceEligibleStageId?: string | null
  graceEligibleStageLabel?: string | null
  gracePrice?: number | null
}

interface Props {
  entry: EntryLike
  disabled?: boolean
  compact?: boolean
  stacked?: boolean
  selectOnly?: boolean
  onUpdate: (entryId: string, paymentStatus: string) => void
  onRequestPaidConfirm: (entryId: string, presetStageId?: string | null) => void
  onRequestDebtConfirm: (entryId: string) => void
}

function canSelectRegistrationStage(paymentStatus: string): boolean {
  return paymentStatus === 'UNPAID' || paymentStatus === 'PAYMENT_REVIEW'
}

export function AdminEntryPaymentActions({
  entry,
  disabled = false,
  compact = false,
  stacked = false,
  selectOnly = false,
  onUpdate,
  onRequestPaidConfirm,
  onRequestDebtConfirm,
}: Props) {
  const allowStagePaymentSelection = canSelectRegistrationStage(entry.paymentStatus)

  const handleStatusUpdate = (entryId: string, paymentStatus: string) => {
    if (disabled) return

    if (paymentStatus === 'PAID') {
      onRequestPaidConfirm(entryId, null)
      return
    }

    if (paymentStatus === 'DEBT') {
      onRequestDebtConfirm(entryId)
      return
    }

    if (paymentStatus === 'UNPAID' && entry.paymentStatus === 'PAID') {
      if (!window.confirm('Отменить оплату? Квитанции сохранятся, но статус и сумма изменятся.')) {
        return
      }
    }

    onUpdate(entryId, paymentStatus)
  }

  return (
    <AdminEntryPaymentStatusControl
      entryId={entry.id}
      paymentStatus={entry.paymentStatus}
      paymentStatusLabel={entry.paymentStatusLabel}
      compact={compact}
      stacked={stacked}
      selectOnly={selectOnly}
      allowStagePaymentSelection={allowStagePaymentSelection}
      onSelectRegistrationStage={(entryId) => {
        if (disabled) return
        onRequestPaidConfirm(entryId, null)
      }}
      onUpdate={handleStatusUpdate}
    />
  )
}
