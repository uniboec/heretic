import { EntryPaymentStatusBadge } from '@/components/ui/EntryPaymentStatusBadge'
import { cn } from '@/lib/cn'
import {
  adminEntryPaymentControl,
  adminEntryPaymentControlStacked,
  adminEntryPaymentSelectClass,
  adminEntryPaymentSelectTable,
  adminInput,
} from '@/lib/ui/adminSurfaceStyles'
import { getEntryPaymentStatusLabel, type EntryPaymentStatus } from '@/lib/registration/status'

export const SELECT_REGISTRATION_STAGE_VALUE = '__SELECT_REGISTRATION_STAGE__'

function statusOptions(currentStatus: EntryPaymentStatus) {
  const options = [
    { value: 'UNPAID', label: 'Не оплачен' },
    { value: 'PAYMENT_REVIEW', label: 'На проверке' },
    { value: 'PAID', label: 'Оплачен' },
    { value: 'ADMITTED_WITHOUT_PAYMENT', label: 'Допущен без оплаты' },
  ] as const

  if (currentStatus !== 'PAID') {
    return [...options, { value: 'DEBT' as const, label: 'Долг' }]
  }

  return options
}

export function AdminEntryPaymentStatusControl({
  entryId,
  paymentStatus,
  paymentStatusLabel,
  onUpdate,
  compact = false,
  stacked = false,
  selectOnly = false,
  allowStagePaymentSelection = false,
  onSelectRegistrationStage,
}: {
  entryId: string
  paymentStatus: string
  paymentStatusLabel?: string
  onUpdate: (entryId: string, paymentStatus: string) => void
  compact?: boolean
  stacked?: boolean
  selectOnly?: boolean
  allowStagePaymentSelection?: boolean
  onSelectRegistrationStage?: (entryId: string) => void
}) {
  const status = (paymentStatus ?? 'UNPAID') as EntryPaymentStatus
  const label = paymentStatusLabel ?? getEntryPaymentStatusLabel(status)
  const options = statusOptions(status)
  const selectClassName = cn(adminInput, adminEntryPaymentSelectClass(status))

  const handleChange = (value: string) => {
    if (value === SELECT_REGISTRATION_STAGE_VALUE) {
      onSelectRegistrationStage?.(entryId)
      return
    }
    onUpdate(entryId, value)
  }

  const stageOption =
    allowStagePaymentSelection && onSelectRegistrationStage ? (
      <option value={SELECT_REGISTRATION_STAGE_VALUE}>Выбрать этап регистрации</option>
    ) : null

  if (selectOnly) {
    return (
      <select
        className={cn(selectClassName, adminEntryPaymentSelectTable)}
        value={status}
        onChange={(event) => handleChange(event.target.value)}
        aria-label={`Статус оплаты: ${label}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {stageOption}
      </select>
    )
  }

  return (
    <div
      className={cn(
        adminEntryPaymentControl,
        stacked && adminEntryPaymentControlStacked,
        !stacked && !compact && 'mt-1',
      )}
    >
      <EntryPaymentStatusBadge status={status} label={label} />
      <select
        className={cn(selectClassName, 'py-1.5 text-xs')}
        value={status}
        onChange={(event) => handleChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {stageOption}
      </select>
    </div>
  )
}
