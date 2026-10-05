import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import {
  listAdminAthletes,
} from '@/lib/registration/adminAthletesList'
import { ensureUnpaidPricesMatchCurrentStage } from '@/lib/registration/stagePricing'

export async function GET(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await ensureUnpaidPricesMatchCurrentStage()

    const { searchParams } = new URL(request.url)
    const athletes = await listAdminAthletes({
      q: searchParams.get('q') ?? undefined,
      gender: searchParams.get('gender') ?? undefined,
      discipline: searchParams.get('discipline') ?? undefined,
      paymentStatus: searchParams.get('paymentStatus') ?? undefined,
      registrationStatus: searchParams.get('registrationStatus') ?? undefined,
      experienceLevel: searchParams.get('experienceLevel') ?? undefined,
    })

    return NextResponse.json({ athletes })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
