import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { resetLiveBracketsStandalone } from '@/lib/brackets/live/reset'

export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { expectedVersion, impactToken } = body as {
      expectedVersion: number
      impactToken: string
    }

    if (expectedVersion === undefined || !impactToken) {
      return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.INVALID_BODY }, { status: 400 })
    }

    const result = await resetLiveBracketsStandalone({ expectedVersion, impactToken })
    return NextResponse.json(result)
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
