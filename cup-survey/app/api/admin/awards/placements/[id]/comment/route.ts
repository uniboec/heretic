import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { awardsErrorResponse } from '@/lib/awards/api'
import { updatePlacementComment } from '@/lib/awards/mutations'
import { PlacementCommentPatchSchema } from '@/lib/awards/schemas'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { NO_STORE_HEADERS } from '@/lib/bouts/routeSegmentConfig'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const { id: placementId } = await context.params
    const body = await request.json()
    const parsed = PlacementCommentPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        { status: 400 },
      )
    }

    const placement = await prisma.awardCeremonyPlacement.findUnique({
      where: { id: placementId },
      select: { queueId: true },
    })
    if (!placement) {
      return NextResponse.json({ error: 'Placement not found' }, { status: 404 })
    }

    const result = await updatePlacementComment({
      operationId: parsed.data.operationId,
      queueId: placement.queueId,
      placementId,
      expectedRevision: parsed.data.expectedRevision,
      adminComment: parsed.data.adminComment,
      publicComment: parsed.data.publicComment,
    })
    return NextResponse.json(result, { headers: NO_STORE_HEADERS })
  } catch (error) {
    return awardsErrorResponse(error)
  }
}
