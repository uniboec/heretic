import { NextResponse } from 'next/server'
import type { AnnouncerEventType } from '@prisma/client'
import { announcerErrorResponse } from '@/lib/announcer/api'
import { requireAnnouncerAdmin } from '@/lib/announcer/adminAuth'
import { announcerHeaders } from '@/lib/announcer/routeConfig'
import { AnnouncerRulePatchSchema, RulesReorderSchema } from '@/lib/announcer/schemas'
import { getAnnouncerRules, reorderAnnouncerRules, updateAnnouncerRule } from '@/lib/announcer/rules'
import { kickAnnouncerWorker } from '@/lib/announcer/worker'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const rules = await getAnnouncerRules()
    return NextResponse.json({ rules }, { headers: announcerHeaders })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const eventType = body.eventType as AnnouncerEventType | undefined
    if (!eventType) {
      return NextResponse.json({ error: 'eventType is required' }, { status: 400 })
    }

    const parsed = AnnouncerRulePatchSchema.safeParse(body.patch ?? body)
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        { status: 400 },
      )
    }

    const rule = await updateAnnouncerRule(eventType, parsed.data)
    kickAnnouncerWorker()
    return NextResponse.json({ rule }, { headers: announcerHeaders })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = RulesReorderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        { status: 400 },
      )
    }
    const rules = await reorderAnnouncerRules(parsed.data.orderedEventTypes)
    kickAnnouncerWorker()
    return NextResponse.json({ rules }, { headers: announcerHeaders })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}
