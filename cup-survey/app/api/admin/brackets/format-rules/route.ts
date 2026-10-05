import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { getBracketFormatRules, updateBracketFormatRules } from '@/lib/brackets/service'

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const rules = await getBracketFormatRules()
    return NextResponse.json({ rules })
  } catch (error) {
    return bracketErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const body = await request.json()
    const result = await updateBracketFormatRules(body)
    if ('errors' in result) {
      return NextResponse.json({ errors: result.errors }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
