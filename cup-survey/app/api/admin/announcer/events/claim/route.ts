import { NextResponse } from 'next/server'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { announcerErrorResponse, claimCodeStatus } from '@/lib/announcer/api'
import { requireAnnouncerAdmin } from '@/lib/announcer/adminAuth'
import { claimForPlayback } from '@/lib/announcer/claimPlayback'
import { announcerHeaders } from '@/lib/announcer/routeConfig'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST() {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const result = await claimForPlayback({
      scopeId: TOURNAMENT_SCOPE_ID,
      requireAuto: true,
    })
    if (!result.ok) {
      if (result.code === 'NO_EVENT' || result.code === 'GAP_ACTIVE' || result.code === 'ALREADY_PLAYING') {
        return new NextResponse(null, { status: 204, headers: announcerHeaders })
      }
      return NextResponse.json({ code: result.code }, { status: claimCodeStatus(result.code), headers: announcerHeaders })
    }
    return NextResponse.json({ snapshot: result.snapshot }, { headers: announcerHeaders })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}
