import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import { getRegistrationKpi } from '@/lib/registration/service'

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const kpi = await getRegistrationKpi()
    return NextResponse.json(kpi)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
