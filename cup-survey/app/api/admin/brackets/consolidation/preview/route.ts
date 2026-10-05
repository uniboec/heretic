import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { previewConsolidation } from '@/lib/brackets/consolidation/apply'
import { validateConsolidationPolicy } from '@/lib/brackets/consolidation/policyHash'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'

export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { expectedVersion, policy: rawPolicy } = body as {
      expectedVersion: number
      policy?: unknown
    }

    if (expectedVersion === undefined) {
      return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.INVALID_BODY }, { status: 400 })
    }

    const policy = validateConsolidationPolicy(rawPolicy)
    if (!policy) {
      return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.INVALID_BODY }, { status: 400 })
    }

    const result = await previewConsolidation({ expectedVersion, policy })
    return NextResponse.json(result)
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
