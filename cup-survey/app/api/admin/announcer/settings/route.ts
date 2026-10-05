import { NextResponse } from 'next/server'
import { announcerErrorResponse } from '@/lib/announcer/api'
import { requireAnnouncerAdmin } from '@/lib/announcer/adminAuth'
import { announcerHeaders } from '@/lib/announcer/routeConfig'
import { AnnouncerSettingsPatchSchema } from '@/lib/announcer/schemas'
import { ensureAnnouncerRules } from '@/lib/announcer/rules'
import { ensureAnnouncerSettings, getAnnouncerSettings, updateAnnouncerSettings } from '@/lib/announcer/settings'
import { kickAnnouncerWorker } from '@/lib/announcer/worker'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const settings = await getAnnouncerSettings()
    await ensureAnnouncerRules()
    return NextResponse.json({ settings }, { headers: announcerHeaders })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = AnnouncerSettingsPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        { status: 400 },
      )
    }
    await ensureAnnouncerSettings()
    const settings = await updateAnnouncerSettings(parsed.data)
    kickAnnouncerWorker()
    return NextResponse.json({ settings }, { headers: announcerHeaders })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}
