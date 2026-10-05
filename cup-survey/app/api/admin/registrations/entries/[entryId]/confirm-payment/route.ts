import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import { buildEntryManualPaymentContext, confirmEntryPaymentAsAdmin } from '@/lib/registration/manualPayment'
import { loadRegistrationSchedule } from '@/lib/registration/schedule'
import { registrationImpactErrorResponse } from '@/lib/registration/registrationImpactErrors'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await loadRegistrationSchedule()

    const { entryId } = await params
    const context = await buildEntryManualPaymentContext(entryId)
    if (!context) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

    return NextResponse.json(context)
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await loadRegistrationSchedule()

    const { entryId } = await params
    const body = await request.json().catch(() => null)
    const paymentStageId = String(body?.paymentStageId ?? '').trim()
    const paidAt = String(body?.paidAt ?? '').trim()
    const comment = typeof body?.comment === 'string' ? body.comment : undefined
    const withoutProof = Boolean(body?.withoutProof)
    const impactToken = typeof body?.impactToken === 'string' ? body.impactToken : undefined

    if (!paymentStageId || !paidAt) {
      return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
    }

    const result = await confirmEntryPaymentAsAdmin({
      entryId,
      paymentStageId,
      paidAt,
      comment,
      withoutProof,
      impactToken,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const impactResponse = registrationImpactErrorResponse(error)
    if (impactResponse) return impactResponse
    const message = error instanceof Error ? error.message : 'SERVER_ERROR'
    if (message === 'NOT_FOUND') return NextResponse.json({ error: message }, { status: 404 })
    if (message === 'ALREADY_PAID') return NextResponse.json({ error: message }, { status: 409 })
    if (
      message === 'INVALID_STAGE' ||
      message === 'INVALID_PAID_AT' ||
      message === 'PAID_AT_IN_FUTURE'
    ) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return apiErrorResponse(error)
  }
}
