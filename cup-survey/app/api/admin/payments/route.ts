import type { PaymentProofStatus, Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import type { ExperienceLevelId } from '@/lib/config/experienceLevel'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import { prisma } from '@/lib/prisma'
import { formatAthleteFullName } from '@/lib/registration/athleteName'
import { getTournamentCategoryLabel } from '@/lib/registration/categoryRules'
import { getEntryPaymentStatusLabel, type EntryPaymentStatus } from '@/lib/registration/status'
import { ensureUnpaidPricesMatchCurrentStage } from '@/lib/registration/stagePricing'

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

function buildPaymentsWhere(searchParams: URLSearchParams): Prisma.PaymentProofWhereInput {
  const query = searchParams.get('q')?.trim()
  const status = searchParams.get('status')?.trim()

  const and: Prisma.PaymentProofWhereInput[] = []

  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    and.push({ status: status as PaymentProofStatus })
  }

  if (query) {
    const or: Prisma.PaymentProofWhereInput[] = [
      { registration: { clubName: { contains: query, mode: 'insensitive' } } },
      { registration: { city: { contains: query, mode: 'insensitive' } } },
      {
        entries: {
          some: {
            entry: {
              athlete: {
                OR: [
                  { lastName: { contains: query, mode: 'insensitive' } },
                  { firstName: { contains: query, mode: 'insensitive' } },
                  { middleName: { contains: query, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      },
    ]

    const publicNumber = Number.parseInt(query, 10)
    if (!Number.isNaN(publicNumber)) {
      or.push({ registration: { publicNumber } })
    }

    and.push({ OR: or })
  }

  if (and.length === 0) return {}
  return { AND: and }
}

export async function GET(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await ensureUnpaidPricesMatchCurrentStage()

    const { searchParams } = new URL(request.url)
    const where = buildPaymentsWhere(searchParams)

    const proofs = await prisma.paymentProof.findMany({
    where,
    orderBy: [{ uploadedAt: 'desc' }],
    include: {
      registration: {
        select: {
          id: true,
          publicNumber: true,
          clubName: true,
          city: true,
          status: true,
        },
      },
      entries: {
        include: {
          entry: {
            include: {
              athlete: {
                select: {
                  lastName: true,
                  firstName: true,
                  middleName: true,
                },
              },
            },
          },
        },
      },
    },
  })

  const allProofs = await prisma.paymentProof.findMany({
    select: { status: true, amount: true },
  })

  const kpi = {
    total: allProofs.length,
    pending: allProofs.filter((proof) => proof.status === 'pending').length,
    approved: allProofs.filter((proof) => proof.status === 'approved').length,
    rejected: allProofs.filter((proof) => proof.status === 'rejected').length,
    approvedAmount: allProofs
      .filter((proof) => proof.status === 'approved')
      .reduce((sum, proof) => sum + (proof.amount ?? 0), 0),
  }

  return NextResponse.json({
    kpi,
    payments: proofs.map((proof) => {
      const entries = proof.entries.map((link) => {
        const entry = link.entry
        const athleteName = formatAthleteFullName({
          lastName: entry.athlete.lastName,
          firstName: entry.athlete.firstName,
          middleName: entry.athlete.middleName,
        })

        return {
          id: entry.id,
          label: formatEntryLabel(entry),
          athleteName,
          price: entry.price,
          paymentStatus: entry.paymentStatus,
          paymentStatusLabel: getEntryPaymentStatusLabel(entry.paymentStatus as EntryPaymentStatus),
          paidAt: entry.paidAt?.toISOString() ?? null,
        }
      })

      const athleteNames = [...new Set(entries.map((entry) => entry.athleteName))]

      return {
        id: proof.id,
        registrationId: proof.registrationId,
        status: proof.status,
        uploadedAt: proof.uploadedAt.toISOString(),
        reviewedAt: proof.reviewedAt?.toISOString() ?? null,
        amount: proof.amount,
        mimeType: proof.mimeType,
        adminComment: proof.adminComment,
        entryCount: entries.length,
        athletesSummary: athleteNames.join(', '),
        entries,
        registration: proof.registration,
      }
    }),
  })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
