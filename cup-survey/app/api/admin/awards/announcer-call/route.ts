import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { awardsErrorResponse } from '@/lib/awards/api'
import { AwardAnnouncerCallSchema } from '@/lib/awards/schemas'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { NO_STORE_HEADERS } from '@/lib/bouts/routeSegmentConfig'
import {
  AwardAnnouncerCallError,
  enqueueAwardRepeatCall,
} from '@/lib/announcer/hooks/awardRepeatCall'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = AwardAnnouncerCallSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        { status: 400 },
      )
    }

    const result = await enqueueAwardRepeatCall({
      queueId: parsed.data.queueId,
      kind: parsed.data.kind,
      placementId: parsed.data.placementId,
    })

    return NextResponse.json(result, { headers: NO_STORE_HEADERS })
  } catch (error) {
    if (error instanceof AwardAnnouncerCallError) {
      return NextResponse.json({ code: error.code, error: error.message }, { status: 400 })
    }
    return awardsErrorResponse(error)
  }
}
