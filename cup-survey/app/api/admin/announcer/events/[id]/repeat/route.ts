import { NextResponse } from 'next/server'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { announcerErrorResponse } from '@/lib/announcer/api'
import { requireAnnouncerAdmin } from '@/lib/announcer/adminAuth'
import { createManualRepeatEvent } from '@/lib/announcer/positionState'
import { kickAnnouncerWorker } from '@/lib/announcer/worker'
import { announcerHeaders } from '@/lib/announcer/routeConfig'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const eventId = await createManualRepeatEvent({
      scopeId: TOURNAMENT_SCOPE_ID,
      sourceEventId: id,
    })
    kickAnnouncerWorker()
    return NextResponse.json({ eventId }, { headers: announcerHeaders })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}
