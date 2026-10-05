import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { awardsErrorResponse } from '@/lib/awards/api'
import { getAdminAwardsDashboard } from '@/lib/awards/service'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { NO_STORE_HEADERS } from '@/lib/bouts/routeSegmentConfig'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const dashboard = await getAdminAwardsDashboard()
    return NextResponse.json(dashboard, { headers: NO_STORE_HEADERS })
  } catch (error) {
    return awardsErrorResponse(error)
  }
}
