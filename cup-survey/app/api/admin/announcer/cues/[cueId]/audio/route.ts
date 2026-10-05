import { NextResponse } from 'next/server'
import { announcerErrorResponse } from '@/lib/announcer/api'
import { requireAnnouncerAdmin } from '@/lib/announcer/adminAuth'
import { readCustomCueFile } from '@/lib/announcer/cueStorage'
import { announcerHeaders } from '@/lib/announcer/routeConfig'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cueId: string }> },
) {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const { cueId } = await params
    if (!cueId.startsWith('custom-')) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404, headers: announcerHeaders })
    }

    const file = await readCustomCueFile(TOURNAMENT_SCOPE_ID, cueId)
    if (!file) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404, headers: announcerHeaders })
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        ...announcerHeaders,
        'Content-Type': file.mimeType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}
