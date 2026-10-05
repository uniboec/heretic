import type { Prisma } from '@prisma/client'
import type { MandateCheckStatus } from '@prisma/client'
import { MAX_ACTUAL_WEIGHT_KG, type MandatePatchInput } from './types'

export class MandatePatchValidationError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'MandatePatchValidationError'
  }
}

export function validateActualWeightKg(value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new MandatePatchValidationError('Вес должен быть больше 0', 'INVALID_WEIGHT')
  }
  if (value > MAX_ACTUAL_WEIGHT_KG) {
    throw new MandatePatchValidationError(
      `Вес не может превышать ${MAX_ACTUAL_WEIGHT_KG} кг`,
      'INVALID_WEIGHT',
    )
  }
}

type MandateCheckWriteData = Prisma.AthleteMandateCheckUpdateInput

export function buildMandatePatchData(input: {
  patch: MandatePatchInput
  existing?: {
    medicalStatus: MandateCheckStatus
    insuranceStatus: MandateCheckStatus
    documentsStatus: MandateCheckStatus
    weightCheckMode: string | null
    actualWeightKg: { toNumber(): number } | null
    manualWeightVerified: boolean
    manualWeightCategoryFingerprint: string | null
    comment: string | null
  } | null
  serverCategoryFingerprint: string
}): MandateCheckWriteData {
  const { patch, serverCategoryFingerprint } = input
  const data: MandateCheckWriteData = {}

  if (patch.medicalStatus !== undefined) {
    data.medicalStatus = patch.medicalStatus
  }
  if (patch.insuranceStatus !== undefined) {
    data.insuranceStatus = patch.insuranceStatus
  }
  if (patch.documentsStatus !== undefined) {
    data.documentsStatus = patch.documentsStatus
  }
  if (patch.comment !== undefined) {
    data.comment = patch.comment
  }

  if (patch.resetWeightCheck) {
    data.weightCheckMode = null
    data.actualWeightKg = null
    data.manualWeightVerified = false
    data.manualWeightCategoryFingerprint = null
    return data
  }

  if (patch.actualWeightKg !== undefined) {
    if (patch.actualWeightKg === null) {
      data.weightCheckMode = null
      data.actualWeightKg = null
      data.manualWeightVerified = false
      data.manualWeightCategoryFingerprint = null
    } else {
      validateActualWeightKg(patch.actualWeightKg)
      data.weightCheckMode = 'AUTO'
      data.actualWeightKg = patch.actualWeightKg
      data.manualWeightVerified = false
      data.manualWeightCategoryFingerprint = null
    }
    return data
  }

  if (patch.manualWeightIssue !== undefined) {
    if (patch.manualWeightIssue) {
      data.weightCheckMode = 'MANUAL_ISSUE'
      data.actualWeightKg = null
      data.manualWeightVerified = false
      data.manualWeightCategoryFingerprint = null
    } else {
      data.weightCheckMode = null
      data.actualWeightKg = null
      data.manualWeightVerified = false
      data.manualWeightCategoryFingerprint = null
    }
    return data
  }

  if (patch.manualWeightVerified !== undefined) {
    if (patch.manualWeightVerified) {
      data.weightCheckMode = 'MANUAL'
      data.actualWeightKg = null
      data.manualWeightVerified = true
      data.manualWeightCategoryFingerprint = serverCategoryFingerprint
    } else {
      data.weightCheckMode = null
      data.actualWeightKg = null
      data.manualWeightVerified = false
      data.manualWeightCategoryFingerprint = null
    }
  }

  return data
}

export function serializeMandateCheckRecord(
  row: {
    medicalStatus: MandateCheckStatus
    insuranceStatus: MandateCheckStatus
    documentsStatus: MandateCheckStatus
    weightCheckMode: string | null
    actualWeightKg: { toNumber(): number } | null
    manualWeightVerified: boolean
    manualWeightCategoryFingerprint: string | null
    comment: string | null
    updatedAt: Date
  } | null,
) {
  if (!row) return null
  return {
    medicalStatus: row.medicalStatus,
    insuranceStatus: row.insuranceStatus,
    documentsStatus: row.documentsStatus,
    weightCheckMode: row.weightCheckMode,
    actualWeightKg: row.actualWeightKg?.toNumber() ?? null,
    manualWeightVerified: row.manualWeightVerified,
    manualWeightCategoryFingerprint: row.manualWeightCategoryFingerprint,
    comment: row.comment,
    updatedAt: row.updatedAt.toISOString(),
  }
}
