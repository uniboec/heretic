import { NextResponse } from 'next/server'
import { announcerErrorResponse } from '@/lib/announcer/api'
import { requireAnnouncerAdmin } from '@/lib/announcer/adminAuth'
import { refreshAnnouncerDashboard, startAnnouncer } from '@/lib/announcer/lifecycle'
import { announcerHeaders } from '@/lib/announcer/routeConfig'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST() {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    await startAnnouncer()
    const dashboard = await refreshAnnouncerDashboard()
    return NextResponse.json(dashboard, { headers: announcerHeaders })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}
