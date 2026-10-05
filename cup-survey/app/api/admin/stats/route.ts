import { NextResponse } from 'next/server'
import { buildAdminStats } from '@/lib/analytics'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import { prisma } from '@/lib/prisma'

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const responses = await prisma.surveyResponse.findMany({ orderBy: { createdAt: 'desc' } })
    const stats = buildAdminStats(responses)
    return NextResponse.json(stats)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
