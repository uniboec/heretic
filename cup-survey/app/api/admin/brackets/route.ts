import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { getAdminBracketsDashboard } from '@/lib/brackets/service'

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const data = await getAdminBracketsDashboard()
    return NextResponse.json(data)
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
