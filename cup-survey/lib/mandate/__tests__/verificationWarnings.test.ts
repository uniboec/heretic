import { describe, expect, it } from 'vitest'
import { buildEntryVerificationWarnings } from '../verificationWarnings'
import type { MandateCheckRecord } from '../types'

const baseCheck: MandateCheckRecord = {
  medicalStatus: 'VERIFIED',
  insuranceStatus: 'VERIFIED',
  documentsStatus: 'VERIFIED',
  weightCheckMode: 'AUTO',
  actualWeightKg: 70,
  manualWeightVerified: false,
  manualWeightCategoryFingerprint: null,
  comment: null,
  updatedAt: '2026-10-02T00:00:00.000Z',
}

describe('buildEntryVerificationWarnings', () => {
  it('shows weight issue only for the bout category, not other athlete categories', () => {
    const warnings = buildEntryVerificationWarnings({
      entryId: 'entry-66',
      categoryKey: 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66',
      paymentStatus: 'PAID',
      athleteCategoryKeys: [
        'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66',
        'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_71',
      ],
      check: baseCheck,
    })

    expect(warnings.some((warning) => warning.code === 'WEIGHT_OVER_LIMIT')).toBe(true)
    expect(warnings.some((warning) => warning.message.includes('до 71'))).toBe(false)
  })

  it('uses entry payment status only', () => {
    const warnings = buildEntryVerificationWarnings({
      entryId: 'entry-paid',
      categoryKey: 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66',
      paymentStatus: 'PAID',
      athleteCategoryKeys: ['tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66'],
      check: baseCheck,
    })

    expect(warnings.some((warning) => warning.code.startsWith('PAYMENT_'))).toBe(false)

    const debtWarnings = buildEntryVerificationWarnings({
      entryId: 'entry-debt',
      categoryKey: 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_71',
      paymentStatus: 'DEBT',
      athleteCategoryKeys: [
        'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66',
        'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_71',
      ],
      check: baseCheck,
    })

    expect(debtWarnings.some((warning) => warning.code === 'PAYMENT_DEBT')).toBe(true)
  })

  it('shows manual weight issue warning without entered weight', () => {
    const warnings = buildEntryVerificationWarnings({
      entryId: 'entry-manual-issue',
      categoryKey: 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66',
      paymentStatus: 'PAID',
      athleteCategoryKeys: ['tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66'],
      check: {
        ...baseCheck,
        weightCheckMode: 'MANUAL_ISSUE',
        actualWeightKg: null,
        manualWeightVerified: false,
      },
    })

    expect(warnings.some((warning) => warning.code === 'WEIGHT_MANUAL_ISSUE')).toBe(true)
  })

  it('warns when weight fails another athlete category even if bout category passes', () => {
    const warnings = buildEntryVerificationWarnings({
      entryId: 'entry-71',
      categoryKey: 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_71',
      paymentStatus: 'PAID',
      athleteCategoryKeys: [
        'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66',
        'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_71',
      ],
      check: baseCheck,
    })

    expect(warnings.some((warning) => warning.code === 'WEIGHT_OVER_LIMIT')).toBe(true)
    expect(
      warnings.some((warning) => warning.message.includes('заявленным категориям')),
    ).toBe(true)
    expect(warnings.some((warning) => warning.message.includes('до 71'))).toBe(false)
  })

  it('lists document warnings before medical and insurance warnings', () => {
    const warnings = buildEntryVerificationWarnings({
      entryId: 'entry-order',
      categoryKey: 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66',
      paymentStatus: 'PAID',
      athleteCategoryKeys: ['tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66'],
      check: {
        ...baseCheck,
        documentsStatus: 'UNCHECKED',
        medicalStatus: 'UNCHECKED',
        insuranceStatus: 'UNCHECKED',
      },
    })

    const statusCodes = warnings
      .map((warning) => warning.code)
      .filter((code) => code.startsWith('DOCUMENTS_') || code.startsWith('MEDICAL_') || code.startsWith('INSURANCE_'))

    expect(statusCodes).toEqual(['DOCUMENTS_UNCHECKED', 'MEDICAL_UNCHECKED', 'INSURANCE_UNCHECKED'])
  })

  it('shows documents warnings when documents are unchecked or rejected', () => {
    const unchecked = buildEntryVerificationWarnings({
      entryId: 'entry-docs',
      categoryKey: 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66',
      paymentStatus: 'PAID',
      athleteCategoryKeys: ['tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66'],
      check: {
        ...baseCheck,
        documentsStatus: 'UNCHECKED',
      },
    })
    expect(unchecked.some((warning) => warning.code === 'DOCUMENTS_UNCHECKED')).toBe(true)

    const issue = buildEntryVerificationWarnings({
      entryId: 'entry-docs-issue',
      categoryKey: 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66',
      paymentStatus: 'PAID',
      athleteCategoryKeys: ['tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66'],
      check: {
        ...baseCheck,
        documentsStatus: 'ISSUE',
      },
    })
    expect(issue.some((warning) => warning.code === 'DOCUMENTS_ISSUE')).toBe(true)
  })

  it('shows weight over-limit warning when entered weight exceeds category', () => {
    const warnings = buildEntryVerificationWarnings({
      entryId: 'entry-over-limit',
      categoryKey: 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66',
      paymentStatus: 'PAID',
      athleteCategoryKeys: ['tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66'],
      check: {
        ...baseCheck,
        weightCheckMode: 'AUTO',
        actualWeightKg: 70,
      },
    })

    expect(warnings.some((warning) => warning.code === 'WEIGHT_OVER_LIMIT')).toBe(true)
  })
})
