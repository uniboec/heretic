import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BoutsConfigurationError } from '@/lib/bouts/errors'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { setCategoriesBoutsReleased } from '@/lib/brackets/service'

export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const body = await request.json()
    const result = await setCategoriesBoutsReleased(body)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof BoutsConfigurationError) {
      return NextResponse.json(
        { errors: [{ code: error.code, message: error.message }] },
        { status: 422 },
      )
    }
    return bracketErrorResponse(error)
  }
}
