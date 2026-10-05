import { NextResponse } from 'next/server'
import type { MandateCheckStatus } from '@prisma/client'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import { patchMandateCommissionAthlete } from '@/lib/mandate/adminMandateList'
import {
  MandatePatchValidationError,
} from '@/lib/mandate/patchMandateCheck'
import type { MandatePatchInput } from '@/lib/mandate/types'

const STATUS_VALUES: MandateCheckStatus[] = ['UNCHECKED', 'VERIFIED', 'ISSUE']

function parsePatchBody(body: unknown): MandatePatchInput {
  if (!body || typeof body !== 'object') {
    throw new MandatePatchValidationError('Invalid body', 'INVALID_BODY')
  }

  const record = body as Record<string, unknown>
  const patch: MandatePatchInput = {}

  if ('medicalStatus' in record) {
    const value = record.medicalStatus
    if (typeof value !== 'string' || !STATUS_VALUES.includes(value as MandateCheckStatus)) {
      throw new MandatePatchValidationError('Invalid medicalStatus', 'INVALID_MEDICAL_STATUS')
    }
    patch.medicalStatus = value as MandateCheckStatus
  }

  if ('insuranceStatus' in record) {
    const value = record.insuranceStatus
    if (typeof value !== 'string' || !STATUS_VALUES.includes(value as MandateCheckStatus)) {
      throw new MandatePatchValidationError('Invalid insuranceStatus', 'INVALID_INSURANCE_STATUS')
    }
    patch.insuranceStatus = value as MandateCheckStatus
  }

  if ('documentsStatus' in record) {
    const value = record.documentsStatus
    if (typeof value !== 'string' || !STATUS_VALUES.includes(value as MandateCheckStatus)) {
      throw new MandatePatchValidationError('Invalid documentsStatus', 'INVALID_DOCUMENTS_STATUS')
    }
    patch.documentsStatus = value as MandateCheckStatus
  }

  if ('actualWeightKg' in record) {
    const value = record.actualWeightKg
    if (value === null) {
      patch.actualWeightKg = null
    } else if (typeof value === 'number') {
      patch.actualWeightKg = value
    } else if (typeof value === 'string' && value.trim() !== '') {
      patch.actualWeightKg = Number(value)
    } else {
      throw new MandatePatchValidationError('Invalid actualWeightKg', 'INVALID_WEIGHT')
    }
  }

  if ('manualWeightVerified' in record) {
    if (typeof record.manualWeightVerified !== 'boolean') {
      throw new MandatePatchValidationError('Invalid manualWeightVerified', 'INVALID_MANUAL_WEIGHT')
    }
    patch.manualWeightVerified = record.manualWeightVerified
  }

  if ('manualWeightIssue' in record) {
    if (typeof record.manualWeightIssue !== 'boolean') {
      throw new MandatePatchValidationError('Invalid manualWeightIssue', 'INVALID_MANUAL_WEIGHT_ISSUE')
    }
    patch.manualWeightIssue = record.manualWeightIssue
  }

  if ('resetWeightCheck' in record) {
    if (record.resetWeightCheck !== true) {
      throw new MandatePatchValidationError('Invalid resetWeightCheck', 'INVALID_RESET_WEIGHT')
    }
    patch.resetWeightCheck = true
  }

  if ('comment' in record) {
    const value = record.comment
    if (value === null) {
      patch.comment = null
    } else if (typeof value === 'string') {
      patch.comment = value
    } else {
      throw new MandatePatchValidationError('Invalid comment', 'INVALID_COMMENT')
    }
  }

  return patch
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { athleteId } = await params
    const body = await request.json()
    const patch = parsePatchBody(body)
    const result = await patchMandateCommissionAthlete({ athleteId, patch })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof MandatePatchValidationError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'ATHLETE_NOT_ELIGIBLE') {
      return NextResponse.json({ error: 'ATHLETE_NOT_ELIGIBLE' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'EMPTY_PATCH') {
      return NextResponse.json({ error: 'EMPTY_PATCH' }, { status: 400 })
    }
    return apiErrorResponse(error)
  }
}
