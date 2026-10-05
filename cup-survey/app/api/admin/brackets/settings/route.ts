import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { getBracketPageSettings, updateBracketSettings } from '@/lib/brackets/service'

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  const settings = await getBracketPageSettings()
  return NextResponse.json({ settings })
}

export async function PATCH(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const body = await request.json()
    const result = await updateBracketSettings(body)
    return NextResponse.json(result)
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
