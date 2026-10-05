import { describe, expect, it } from 'vitest'
import {
  getEntryPaymentKpiBucket,
  getEntryPaymentStatusLabel,
  getPublicEntryPaymentStatusLabel,
  isEntryConfirmedForPublic,
  isEntryEligibleForParticipation,
  isEntryFinanciallySettled,
  isEntryOutstanding,
  toPublicEntryPaymentStatus,
  type EntryPaymentStatus,
} from '../status'
import {
  registrationStatusFromEntries,
  summarizeEntryPayments,
} from '../entryPayment'

const ALL_STATUSES: EntryPaymentStatus[] = [
  'UNPAID',
  'PAYMENT_REVIEW',
  'PAID',
  'ADMITTED_WITHOUT_PAYMENT',
  'DEBT',
]

describe('debt status predicates', () => {
  it('classifies all enum values for participation', () => {
    expect(isEntryEligibleForParticipation('PAID')).toBe(true)
    expect(isEntryEligibleForParticipation('ADMITTED_WITHOUT_PAYMENT')).toBe(true)
    expect(isEntryEligibleForParticipation('DEBT')).toBe(true)
    expect(isEntryEligibleForParticipation('UNPAID')).toBe(false)
    expect(isEntryEligibleForParticipation('PAYMENT_REVIEW')).toBe(false)
  })

  it('classifies financial settlement separately from participation', () => {
    expect(isEntryFinanciallySettled('PAID')).toBe(true)
    expect(isEntryFinanciallySettled('ADMITTED_WITHOUT_PAYMENT')).toBe(true)
    expect(isEntryFinanciallySettled('DEBT')).toBe(false)
  })

  it('classifies outstanding statuses', () => {
    expect(isEntryOutstanding('DEBT')).toBe(true)
    expect(isEntryOutstanding('UNPAID')).toBe(true)
    expect(isEntryOutstanding('PAYMENT_REVIEW')).toBe(true)
    expect(isEntryOutstanding('PAID')).toBe(false)
  })

  it('maps KPI buckets for every status', () => {
    expect(getEntryPaymentKpiBucket('PAID')).toBe('confirmed')
    expect(getEntryPaymentKpiBucket('ADMITTED_WITHOUT_PAYMENT')).toBe('admitted')
    for (const status of ['UNPAID', 'PAYMENT_REVIEW', 'DEBT'] as const) {
      expect(getEntryPaymentKpiBucket(status)).toBe('pending')
    }
  })

  it('covers every status in at least one predicate group', () => {
    for (const status of ALL_STATUSES) {
      const grouped =
        isEntryEligibleForParticipation(status) ||
        isEntryOutstanding(status) ||
        status === 'PAYMENT_REVIEW'
      expect(grouped).toBe(true)
    }
  })
})

describe('debt public masking', () => {
  it('masks DEBT as PAID on public surfaces', () => {
    expect(getPublicEntryPaymentStatusLabel('DEBT')).toBe('Оплачен')
    expect(toPublicEntryPaymentStatus('DEBT')).toBe('PAID')
    expect(isEntryConfirmedForPublic('DEBT')).toBe(true)
  })

  it('keeps admin label for DEBT', () => {
    expect(getEntryPaymentStatusLabel('DEBT')).toBe('Долг')
  })
})

describe('debt registration aggregation', () => {
  it('treats PAID + DEBT mix as participation-confirmed registration', () => {
    expect(registrationStatusFromEntries(['PAID', 'DEBT'])).toBe('PAID')
  })

  it('counts debt entries in summarizeEntryPayments', () => {
    expect(summarizeEntryPayments(['PAID', 'DEBT', 'UNPAID'])).toMatchObject({
      paid: 1,
      debt: 1,
      unpaid: 1,
      total: 3,
    })
  })
})
