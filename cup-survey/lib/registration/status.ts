export type RegistrationStatus =
  | 'SUBMITTED'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_REVIEW'
  | 'PAID'
  | 'PAYMENT_REJECTED'
  | 'CANCELLED'

export type EntryPaymentStatus =
  | 'UNPAID'
  | 'PAYMENT_REVIEW'
  | 'PAID'
  | 'ADMITTED_WITHOUT_PAYMENT'
  | 'DEBT'

export type EntryPaymentKpiBucket = 'confirmed' | 'admitted' | 'pending'

export function isPaidEntryStatus(status: EntryPaymentStatus): boolean {
  return status === 'PAID'
}

export function isAdmittedWithoutPaymentStatus(status: EntryPaymentStatus): boolean {
  return status === 'ADMITTED_WITHOUT_PAYMENT'
}

export function isDebtEntryStatus(status: EntryPaymentStatus): boolean {
  return status === 'DEBT'
}

export function isEntryEligibleForParticipation(status: EntryPaymentStatus): boolean {
  return (
    status === 'PAID' ||
    status === 'ADMITTED_WITHOUT_PAYMENT' ||
    status === 'DEBT'
  )
}

export function isEntryFinanciallySettled(status: EntryPaymentStatus): boolean {
  return status === 'PAID' || status === 'ADMITTED_WITHOUT_PAYMENT'
}

export function isEntryOutstanding(status: EntryPaymentStatus): boolean {
  return status === 'UNPAID' || status === 'PAYMENT_REVIEW' || status === 'DEBT'
}

export function isEntryConfirmedForPublic(status: EntryPaymentStatus): boolean {
  return isEntryEligibleForParticipation(status)
}

export function getEntryPaymentKpiBucket(status: EntryPaymentStatus): EntryPaymentKpiBucket {
  switch (status) {
    case 'PAID':
      return 'confirmed'
    case 'ADMITTED_WITHOUT_PAYMENT':
      return 'admitted'
    default:
      return 'pending'
  }
}

export function isParticipationAffectingEntryStatus(status: EntryPaymentStatus): boolean {
  return isEntryEligibleForParticipation(status)
}

/** @deprecated Prefer isEntryFinanciallySettled / isEntryEligibleForParticipation */
export function isSettledEntryStatus(status: EntryPaymentStatus): boolean {
  return (
    status === 'PAID' ||
    status === 'ADMITTED_WITHOUT_PAYMENT' ||
    status === 'PAYMENT_REVIEW'
  )
}

export function getEntryPaymentStatusLabel(status: EntryPaymentStatus): string {
  switch (status) {
    case 'PAID':
      return 'Оплачен'
    case 'PAYMENT_REVIEW':
      return 'На проверке'
    case 'ADMITTED_WITHOUT_PAYMENT':
      return 'Допущен без оплаты'
    case 'DEBT':
      return 'Долг'
    default:
      return 'Не оплачен'
  }
}

/** Статус для публичных страниц: допущенные без оплаты и долг выглядят как оплаченные. */
export function getPublicEntryPaymentStatusLabel(status: EntryPaymentStatus): string {
  if (status === 'ADMITTED_WITHOUT_PAYMENT' || status === 'DEBT') return 'Оплачен'
  return getEntryPaymentStatusLabel(status)
}

export function toPublicEntryPaymentStatus(status: EntryPaymentStatus): EntryPaymentStatus {
  if (status === 'ADMITTED_WITHOUT_PAYMENT' || status === 'DEBT') return 'PAID'
  return status
}

/** Краткий статус для публичного списка участников */
export function getParticipantListStatusLabel(status: EntryPaymentStatus): string {
  return getPublicEntryPaymentStatusLabel(status)
}

export type RegistrationStatusContext = {
  hasPaidEntries?: boolean
  hasUnpaidEntries?: boolean
  hasReviewEntries?: boolean
}

export function getPublicStatusLabel(
  status: RegistrationStatus,
  context?: RegistrationStatusContext,
): string {
  const hasPaidEntries = context?.hasPaidEntries ?? false
  const hasUnpaidEntries = context?.hasUnpaidEntries ?? false
  const hasReviewEntries = context?.hasReviewEntries ?? false

  if (hasPaidEntries && hasUnpaidEntries) {
    return hasReviewEntries ? 'Частично оплачено, требуется доплата' : 'Требуется доплата'
  }

  switch (status) {
    case 'SUBMITTED':
    case 'AWAITING_PAYMENT':
      return 'Ожидает оплаты'
    case 'PAYMENT_REVIEW':
      return 'Оплата на проверке'
    case 'PAID':
      return 'Участие подтверждено'
    case 'PAYMENT_REJECTED':
      return 'Загрузите чек повторно'
    case 'CANCELLED':
      return 'Регистрация отменена'
    default:
      return 'Ожидает оплаты'
  }
}

export function isConfirmedForPublicList(status: EntryPaymentStatus): boolean {
  return isEntryConfirmedForPublic(status) || status === 'PAYMENT_REVIEW'
}

export function canUploadPayment(status: RegistrationStatus): boolean {
  return (
    status === 'AWAITING_PAYMENT' ||
    status === 'PAYMENT_REJECTED' ||
    status === 'SUBMITTED' ||
    status === 'PAYMENT_REVIEW'
  )
}
