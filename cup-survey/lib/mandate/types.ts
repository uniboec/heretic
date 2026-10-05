import type { MandateCheckStatus, WeightCheckMode } from '@prisma/client'
import type { EntryPaymentStatus } from '@/lib/registration/status'

export const MAX_ACTUAL_WEIGHT_KG = 250

export type WeightCategoryCheckResult =
  | 'PASSED'
  | 'OVER_LIMIT'
  | 'UNDER_LIMIT'
  | 'NOT_APPLICABLE'

export type MandateWarningCode =
  | 'MEDICAL_UNCHECKED'
  | 'MEDICAL_ISSUE'
  | 'INSURANCE_UNCHECKED'
  | 'INSURANCE_ISSUE'
  | 'DOCUMENTS_UNCHECKED'
  | 'DOCUMENTS_ISSUE'
  | 'WEIGHT_NOT_CHECKED'
  | 'WEIGHT_MANUAL_STALE'
  | 'WEIGHT_MANUAL_ISSUE'
  | 'WEIGHT_OVER_LIMIT'
  | 'WEIGHT_UNDER_LIMIT'
  | 'PAYMENT_DEBT'
  | 'PAYMENT_UNPAID'
  | 'PAYMENT_REVIEW'

export interface MandateWarning {
  code: MandateWarningCode
  message: string
}

export interface MandateCategoryWeightResult {
  categoryKey: string
  categoryLabel: string
  result: WeightCategoryCheckResult
  deltaKg?: number
}

export interface WeightStatus {
  hasWeighIn: boolean
  weightEligible: boolean
  manualStale: boolean
  categoryResults: MandateCategoryWeightResult[]
}

export interface MandateCheckRecord {
  medicalStatus: MandateCheckStatus
  insuranceStatus: MandateCheckStatus
  documentsStatus: MandateCheckStatus
  weightCheckMode: WeightCheckMode | null
  actualWeightKg: number | null
  manualWeightVerified: boolean
  manualWeightCategoryFingerprint: string | null
  comment: string | null
  updatedAt: Date | string
}

export interface MandateBracketEntry {
  entryId: string
  categoryKey: string
  categoryLabel: string
  paymentStatus: EntryPaymentStatus
  paymentStatusLabel: string
}

export interface MandateCommissionRow {
  athleteId: string
  lastName: string
  firstName: string
  middleName: string | null
  fullName: string
  clubName: string
  city: string
  bracketEntries: MandateBracketEntry[]
  check: MandateCheckRecord | null
  weightStatus: WeightStatus
  aggregateStatus: 'all_ok' | 'has_issues' | 'not_checked'
  issueCount: number
}

export interface MandateCommissionKpi {
  total: number
  allOk: number
  hasIssues: number
  notChecked: number
  notWeighedIn: number
}

export type MandateCommissionCheckStatusFilter = 'all_ok' | 'has_issues' | 'not_checked'

export interface MandateCommissionListFilters {
  q?: string
  club?: string
  categoryKey?: string
  checkStatus?: MandateCommissionCheckStatusFilter
  issuesOnly?: boolean
  athleteId?: string
}

export interface MandatePatchInput {
  medicalStatus?: MandateCheckStatus
  insuranceStatus?: MandateCheckStatus
  documentsStatus?: MandateCheckStatus
  actualWeightKg?: number | null
  manualWeightVerified?: boolean
  manualWeightIssue?: boolean
  resetWeightCheck?: boolean
  comment?: string | null
}
