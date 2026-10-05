import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import { prisma } from '@/lib/prisma'
import { syncRegistrationTotals } from '@/lib/registration/entryPayment'
import { recalculateUnpaidEntryPricesForRegistration } from '@/lib/registration/categoryDiscounts'
import { fingerprintReviewPayment } from '@/lib/registration/adminImpact'
import { registrationImpactErrorResponse } from '@/lib/registration/registrationImpactErrors'
import { loadCategoryKeysForEntryIds } from '@/lib/brackets/live/impact'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { action, comment, proofId, impactToken } = body as {
      action: 'approve' | 'reject'
      comment?: string
      proofId?: string
      impactToken?: string
    }

    const proof = proofId
      ? await prisma.paymentProof.findFirst({ where: { id: proofId, registrationId: id } })
      : await prisma.paymentProof.findFirst({
          where: { registrationId: id, status: 'pending' },
          orderBy: { uploadedAt: 'desc' },
        })

    if (!proof) return NextResponse.json({ error: 'NO_PROOF' }, { status: 400 })

    const linkedEntries = await prisma.paymentProofEntry.findMany({
      where: { paymentProofId: proof.id },
      select: { entryId: true },
    })
    const entryIds = linkedEntries.map((row) => row.entryId)

    const categoryKeys = entryIds.length
      ? await prisma.$transaction((tx) => loadCategoryKeysForEntryIds(tx, entryIds))
      : []
    const mutationFingerprint = fingerprintReviewPayment({
      registrationId: id,
      action,
      entryIds,
    })
    const { withBracketImpactAfterCommit } = await import('@/lib/registration/bracketImpactCoordinator')

    if (action === 'approve') {
      await withBracketImpactAfterCommit(
        async (tx) => {
          await tx.paymentProof.update({
            where: { id: proof.id },
            data: { status: 'approved', reviewedAt: new Date(), adminComment: comment ?? null },
          })
          await tx.athleteEntry.updateMany({
            where: { id: { in: entryIds } },
            data: { paymentStatus: 'PAID', paidAt: new Date() },
          })
          await tx.teamRegistration.update({
            where: { id },
            data: { adminComment: null },
          })
        },
        {
          registrationId: id,
          mutationFingerprint,
          categoryKeys,
          entryIds,
          impactToken,
        },
      )
    } else {
      await withBracketImpactAfterCommit(
        async (tx) => {
          await tx.paymentProof.update({
            where: { id: proof.id },
            data: { status: 'rejected', reviewedAt: new Date(), adminComment: comment ?? null },
          })
          await tx.athleteEntry.updateMany({
            where: { id: { in: entryIds } },
            data: { paymentStatus: 'UNPAID', paymentStage: null },
          })
          await tx.teamRegistration.update({
            where: { id },
            data: { adminComment: comment ?? null },
          })
        },
        {
          registrationId: id,
          mutationFingerprint,
          categoryKeys,
          entryIds,
          impactToken,
        },
      )
      await recalculateUnpaidEntryPricesForRegistration(id)
    }

    await syncRegistrationTotals(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    const impactResponse = registrationImpactErrorResponse(error)
    if (impactResponse) return impactResponse
    return apiErrorResponse(error)
  }
}
