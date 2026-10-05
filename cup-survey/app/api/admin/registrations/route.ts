import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import { prisma } from '@/lib/prisma'

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rows = await prisma.teamRegistration.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        athletes: { include: { entries: true } },
        paymentProofs: { orderBy: { uploadedAt: 'desc' }, take: 1 },
      },
    })

    return NextResponse.json({
      registrations: rows.map((reg) => ({
        id: reg.id,
        publicNumber: reg.publicNumber,
        createdAt: reg.createdAt.toISOString(),
        clubName: reg.clubName,
        city: reg.city,
        phone: reg.phone,
        athletesCount: reg.athletes.length,
        entryCount: reg.athletes.reduce((sum, a) => sum + a.entries.length, 0),
        totalAmount: reg.totalAmount,
        status: reg.status,
        registrationStage: reg.registrationStage,
        hasProof: reg.paymentProofs.length > 0,
        proofStatus: reg.paymentProofs[0]?.status ?? null,
      })),
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
