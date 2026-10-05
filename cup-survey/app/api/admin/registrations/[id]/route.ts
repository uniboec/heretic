import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import { registrationImpactErrorResponse } from '@/lib/registration/registrationImpactErrors'
import { prisma } from '@/lib/prisma'
import { getRegistrationById } from '@/lib/registration/service'
import { formatAthleteFullName } from '@/lib/registration/athleteName'
import type { ExperienceLevelId } from '@/lib/config/experienceLevel'
import { getTournamentCategoryLabel } from '@/lib/registration/categoryRules'
import { getEntryPaymentStatusLabel, type EntryPaymentStatus } from '@/lib/registration/status'
import { ensureUnpaidPricesMatchCurrentStage } from '@/lib/registration/stagePricing'
import { listActiveCategoryDiscountRules } from '@/lib/registration/categoryDiscounts'
import { getEntryGraceSummary } from '@/lib/registration/manualPayment'

function formatEntryLabel(entry: {
  discipline: string
  ageDivisionId: string | null
  weightCategoryId: string | null
  experienceLevel: string
}): string {
  if (entry.ageDivisionId && entry.weightCategoryId) {
    return getTournamentCategoryLabel(
      entry.ageDivisionId,
      entry.weightCategoryId,
      entry.experienceLevel as ExperienceLevelId,
    )
  }
  return `${entry.discipline} · категория не указана`
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await ensureUnpaidPricesMatchCurrentStage()

    const { id } = await params
    const registration = await getRegistrationById(id)
    if (!registration) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

    const discountRules = await listActiveCategoryDiscountRules()

    const entryMap = new Map<
      string,
      { label: string; athleteName: string; paymentStatus: EntryPaymentStatus }
    >()

    const athletes = registration.athletes.map((athlete) => {
    const athleteName = formatAthleteFullName({
      lastName: athlete.lastName,
      firstName: athlete.firstName,
      middleName: athlete.middleName,
    })

    const entries = athlete.entries.map((entry) => {
      const label = formatEntryLabel(entry)
      entryMap.set(entry.id, {
        label,
        athleteName,
        paymentStatus: entry.paymentStatus as EntryPaymentStatus,
      })
      const grace = getEntryGraceSummary(
        {
          discipline: entry.discipline,
          experienceLevel: entry.experienceLevel,
          ageDivisionId: entry.ageDivisionId,
          paymentStatus: entry.paymentStatus as EntryPaymentStatus,
        },
        registration.registrationStage,
        registration.club?.discountPercent,
        discountRules,
      )
      return {
        id: entry.id,
        discipline: entry.discipline,
        ageDivisionId: entry.ageDivisionId,
        weightCategoryId: entry.weightCategoryId,
        experienceLevel: entry.experienceLevel,
        price: entry.price,
        paymentStatus: entry.paymentStatus,
        paymentStatusLabel: getEntryPaymentStatusLabel(entry.paymentStatus as EntryPaymentStatus),
        ...grace,
      }
    })

    return {
      id: athlete.id,
      lastName: athlete.lastName,
      firstName: athlete.firstName,
      middleName: athlete.middleName,
      birthDate: athlete.birthDate.toISOString().slice(0, 10),
      gender: athlete.gender,
      rank: athlete.rank,
      entries,
    }
  })

  const paymentProofs = await prisma.paymentProof.findMany({
    where: { registrationId: id },
    orderBy: { uploadedAt: 'desc' },
    include: {
      entries: {
        include: {
          entry: {
            include: {
              athlete: {
                select: { lastName: true, firstName: true, middleName: true },
              },
            },
          },
        },
      },
    },
  })

  return NextResponse.json({
    clubName: registration.clubName,
    city: registration.city,
    phone: registration.phone,
    email: registration.email,
    totalAmount: registration.totalAmount,
    pricePerDiscipline: registration.pricePerDiscipline,
    editToken: registration.editToken,
    hasEditCode: Boolean(registration.editCodeHash),
    athletes,
    paymentProofs: paymentProofs.map((proof) => ({
      id: proof.id,
      status: proof.status,
      uploadedAt: proof.uploadedAt.toISOString(),
      amount: proof.amount,
      mimeType: proof.mimeType,
      adminComment: proof.adminComment,
      entries: proof.entries.map((link) => {
        const mapped = entryMap.get(link.entryId)
        if (mapped) {
          return {
            id: link.entryId,
            label: mapped.label,
            athleteName: mapped.athleteName,
            paymentStatus: mapped.paymentStatus,
          }
        }

        const entry = link.entry
        const athleteName = formatAthleteFullName({
          lastName: entry.athlete.lastName,
          firstName: entry.athlete.firstName,
          middleName: entry.athlete.middleName,
        })
        return {
          id: link.entryId,
          label: formatEntryLabel(entry),
          athleteName,
          paymentStatus: entry.paymentStatus as EntryPaymentStatus,
        }
      }),
    })),
  })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { status, adminComment, impactToken } = body as {
      status?: string
      adminComment?: string
      impactToken?: string
    }

    const data: Record<string, unknown> = {}
    if (status) data.status = status
    if (adminComment !== undefined) data.adminComment = adminComment

    const updated = await prisma.teamRegistration.update({
      where: { id },
      data,
    })

    if (status === 'CANCELLED') {
      const { stableJsonHash } = await import('@/lib/brackets/live/impactToken')
      const { loadCategoryKeysForRegistration } = await import('@/lib/registration/bracketAutoSync')
      const { withBracketImpactAfterCommit } = await import('@/lib/registration/bracketImpactCoordinator')
      const categoryKeys = await loadCategoryKeysForRegistration(id)
      const mutationFingerprint = stableJsonHash({
        kind: 'registration_cancelled',
        registrationId: id,
      })
      await withBracketImpactAfterCommit(async () => undefined, {
        registrationId: id,
        mutationFingerprint,
        categoryKeys,
        impactToken,
      })
    }

    return NextResponse.json({ success: true, registration: updated })
  } catch (error) {
    const impactResponse = registrationImpactErrorResponse(error)
    if (impactResponse) return impactResponse
    return apiErrorResponse(error)
  }
}
