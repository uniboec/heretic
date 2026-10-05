import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const page = Number(request.nextUrl.searchParams.get('page') ?? '1')
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? '50')
    const skip = (page - 1) * limit

    const [responses, total] = await Promise.all([
      prisma.surveyResponse.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.surveyResponse.count(),
    ])

    return NextResponse.json({ responses, total, page, limit })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
