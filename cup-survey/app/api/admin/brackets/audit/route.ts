import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { listBracketMoveAudit } from '@/lib/brackets/service'

export async function GET(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const limitRaw = url.searchParams.get('limit')
    const limit = limitRaw != null ? Number(limitRaw) : 100
    const audit = await listBracketMoveAudit(Number.isNaN(limit) ? 100 : limit)

    return NextResponse.json({ audit })
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
