import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import { registrationImpactErrorResponse } from '@/lib/registration/registrationImpactErrors'
import { prisma } from '@/lib/prisma'
import { recalculateUnpaidEntryPricesForRegistration } from '@/lib/registration/categoryDiscounts'
import { syncRegistrationTotals } from '@/lib/registration/entryPayment'
import { loadRegistrationSchedule } from '@/lib/registration/schedule'
import {
  isParticipationAffectingEntryStatus,
  type EntryPaymentStatus,
} from '@/lib/registration/status'

const PATCHABLE_STATUSES: EntryPaymentStatus[] = [
  'UNPAID',
  'PAYMENT_REVIEW',
  'PAID',
  'ADMITTED_WITHOUT_PAYMENT',
]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await loadRegistrationSchedule()

    const { entryId } = await params
    const body = await request.json()
    const { paymentStatus, impactToken } = body as {
      paymentStatus?: EntryPaymentStatus
      impactToken?: string
    }

    if (paymentStatus === 'PAID') {
      return NextResponse.json({ error: 'REQUIRES_PAYMENT_CONFIRMATION' }, { status: 400 })
    }

    if (paymentStatus === 'DEBT') {
      return NextResponse.json({ error: 'REQUIRES_DEBT_CONFIRMATION' }, { status: 400 })
    }

    if (!paymentStatus || !PATCHABLE_STATUSES.includes(paymentStatus)) {
      return NextResponse.json({ error: 'INVALID_STATUS' }, { status: 400 })
    }

    const entry = await prisma.athleteEntry.findUnique({
      where: { id: entryId },
      include: { athlete: { select: { registrationId: true } } },
    })
    if (!entry) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

    const previousStatus = entry.paymentStatus as EntryPaymentStatus
    const eligibilityAffecting =
      previousStatus !== paymentStatus &&
      (isParticipationAffectingEntryStatus(previousStatus) ||
        isParticipationAffectingEntryStatus(paymentStatus))

    const applyPaymentUpdate = async (tx?: Prisma.TransactionClient) => {
      const db = tx ?? prisma
      await db.athleteEntry.update({
        where: { id: entryId },
        data: {
          paymentStatus,
          paidAt: null,
          paymentStage: null,
        },
      })
    }

    if (eligibilityAffecting) {
      const { stableJsonHash } = await import('@/lib/brackets/live/impactToken')
      const { loadCategoryKeysForEntry } = await import('@/lib/registration/bracketAutoSync')
      const { withBracketImpactAfterCommit } = await import('@/lib/registration/bracketImpactCoordinator')
      const categoryKeys = await loadCategoryKeysForEntry(entryId)
      const mutationFingerprint = stableJsonHash({
        kind: 'entry_payment_status',
        entryId,
        paymentStatus,
        previousStatus,
      })
      await withBracketImpactAfterCommit(
        async (tx) => {
          await applyPaymentUpdate(tx)
        },
        {
          registrationId: entry.athlete.registrationId,
          mutationFingerprint,
          categoryKeys,
          entryIds: [entryId],
          impactToken,
        },
      )
    } else {
      await applyPaymentUpdate()
    }

    if (paymentStatus === 'UNPAID') {
      await recalculateUnpaidEntryPricesForRegistration(entry.athlete.registrationId)
    } else {
      await syncRegistrationTotals(entry.athlete.registrationId)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const impactResponse = registrationImpactErrorResponse(error)
    if (impactResponse) return impactResponse
    return apiErrorResponse(error)
  }
}
