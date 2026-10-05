import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { updateBracketDrawCompetitionStage } from '@/lib/bouts/mutations'

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
    const result = await updateBracketDrawCompetitionStage({
      drawId,
      draftId: body.draftId,
      expectedVersion: body.expectedVersion,
      expectedScheduleVersion: body.expectedScheduleVersion,
      competitionStage: body.competitionStage,
    })
    return NextResponse.json(result)
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
