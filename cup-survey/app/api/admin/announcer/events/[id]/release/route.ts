import { NextResponse } from 'next/server'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { announcerErrorResponse } from '@/lib/announcer/api'
import { requireAnnouncerAdmin } from '@/lib/announcer/adminAuth'
import { releasePlayback } from '@/lib/announcer/claimPlayback'
import { announcerHeaders } from '@/lib/announcer/routeConfig'
import { CompleteEventSchema } from '@/lib/announcer/schemas'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const body = await request.json()
    const parsed = CompleteEventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const ok = await releasePlayback({
      scopeId: TOURNAMENT_SCOPE_ID,
      eventId: id,
      claimToken: parsed.data.claimToken,
    })
    if (!ok) {
      return NextResponse.json({ code: 'CLAIM_LOST' }, { status: 409, headers: announcerHeaders })
    }
    return NextResponse.json({ ok: true }, { headers: announcerHeaders })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}
