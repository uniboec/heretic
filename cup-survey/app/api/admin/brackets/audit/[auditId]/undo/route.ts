import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { undoBracketMoveAudit } from '@/lib/brackets/service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ auditId: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const { auditId } = await params
    const body = await request.json()
    const result = await undoBracketMoveAudit({
      auditId,
      draftId: body.draftId,
      expectedVersion: body.expectedVersion,
    })
    return NextResponse.json(result)
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
