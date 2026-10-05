import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { updateBracketDraw } from '@/lib/brackets/service'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ drawId: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const { drawId } = await params
    const body = await request.json()
    const result = await updateBracketDraw({ drawId, ...body })
    return NextResponse.json(result)
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
