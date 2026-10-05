import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import { listMandateCommissionAthletes } from '@/lib/mandate/adminMandateList'
import type { MandateCommissionCheckStatusFilter } from '@/lib/mandate/types'

function parseCheckStatus(value: string | null): MandateCommissionCheckStatusFilter | undefined {
  if (value === 'all_ok' || value === 'has_issues' || value === 'not_checked') {
    return value
  }
  return undefined
}

export async function GET(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const result = await listMandateCommissionAthletes({
      q: searchParams.get('q') ?? undefined,
      club: searchParams.get('club') ?? undefined,
      categoryKey: searchParams.get('categoryKey') ?? undefined,
      checkStatus: parseCheckStatus(searchParams.get('checkStatus')),
      issuesOnly: searchParams.get('issuesOnly') === 'true',
      athleteId: searchParams.get('athleteId') ?? undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
