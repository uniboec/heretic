import { NextResponse } from 'next/server'
import { announcerErrorResponse } from '@/lib/announcer/api'
import { requireAnnouncerAdmin } from '@/lib/announcer/adminAuth'
import { saveCustomCueFile } from '@/lib/announcer/cueStorage'
import { announcerHeaders } from '@/lib/announcer/routeConfig'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: Request) {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const form = await request.formData()
    const file = form.get('file')
    const label = String(form.get('label') ?? '').trim()
    const family = String(form.get('family') ?? 'neutral')
    const durationMs = Number(form.get('durationMs') ?? 600)

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'FILE_REQUIRED' }, { status: 400, headers: announcerHeaders })
    }

    if (!['bout', 'award', 'neutral'].includes(family)) {
      return NextResponse.json({ error: 'INVALID_FAMILY' }, { status: 400, headers: announcerHeaders })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const cue = await saveCustomCueFile({
      scopeId: TOURNAMENT_SCOPE_ID,
      buffer,
      mimeType: file.type || 'application/octet-stream',
      originalFileName: file.name,
      label: label || file.name.replace(/\.[^.]+$/, ''),
      family: family as 'bout' | 'award' | 'neutral',
      durationMs: Number.isFinite(durationMs) ? durationMs : 600,
    })

    return NextResponse.json({ cue }, { headers: announcerHeaders })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INVALID_FILE_TYPE') {
        return NextResponse.json({ error: 'INVALID_FILE_TYPE' }, { status: 400, headers: announcerHeaders })
      }
      if (error.message === 'FILE_TOO_LARGE') {
        return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 400, headers: announcerHeaders })
      }
    }
    return announcerErrorResponse(error)
  }
}
