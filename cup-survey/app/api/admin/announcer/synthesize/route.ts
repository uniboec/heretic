import { NextResponse } from 'next/server'
import { announcerErrorResponse } from '@/lib/announcer/api'
import { requireAnnouncerAdmin } from '@/lib/announcer/adminAuth'
import { announcerHeaders } from '@/lib/announcer/routeConfig'
import { SynthesizeTestSchema } from '@/lib/announcer/schemas'
import { getAnnouncerSettings } from '@/lib/announcer/settings'
import { synthesizeTest } from '@/lib/announcer/tts/synthesize'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: Request) {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = SynthesizeTestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const settings = await getAnnouncerSettings()
    const audio = await synthesizeTest(parsed.data, settings)
    return new NextResponse(new Uint8Array(audio.buffer), {
      headers: {
        ...announcerHeaders,
        'Content-Type': audio.mimeType,
        'X-Announcer-Provider': audio.provider,
      },
    })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}
