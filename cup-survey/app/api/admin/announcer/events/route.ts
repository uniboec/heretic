import { NextResponse } from 'next/server'
import { announcerErrorResponse } from '@/lib/announcer/api'
import { requireAnnouncerAdmin } from '@/lib/announcer/adminAuth'
import { purgeStaleAnnouncerEvents, refreshAnnouncerDashboard } from '@/lib/announcer/lifecycle'
import { announcerHeaders } from '@/lib/announcer/routeConfig'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const dashboard = await refreshAnnouncerDashboard()
    return NextResponse.json(dashboard, { headers: announcerHeaders })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    if (body.action === 'purgeStale') {
      const count = await purgeStaleAnnouncerEvents()
      const dashboard = await refreshAnnouncerDashboard()
      return NextResponse.json({ purged: count, ...dashboard }, { headers: announcerHeaders })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}
