import { NextResponse } from 'next/server'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { announcerErrorResponse } from '@/lib/announcer/api'
import { requireAnnouncerAdmin } from '@/lib/announcer/adminAuth'
import { announcerHeaders } from '@/lib/announcer/routeConfig'
import { kickAnnouncerWorker } from '@/lib/announcer/worker'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const body = await request.json()

    if (body.action === 'skip') {
      await prisma.announcerEvent.updateMany({
        where: {
          id,
          tournamentScopeId: TOURNAMENT_SCOPE_ID,
          status: { in: ['QUEUED', 'READY', 'GENERATING'] },
        },
        data: {
          status: 'SKIPPED',
          generationToken: null,
          generationStartedAt: null,
          generationLeaseUntil: null,
          generationTtsSignature: null,
        },
      })
      kickAnnouncerWorker()
      return NextResponse.json({ ok: true }, { headers: announcerHeaders })
    }

    if (body.action === 'boost') {
      const event = await prisma.announcerEvent.findUnique({ where: { id } })
      if (!event) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      await prisma.announcerEvent.update({
        where: { id },
        data: { priority: event.priority + 5 },
      })
      return NextResponse.json({ ok: true }, { headers: announcerHeaders })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    await prisma.announcerEvent.updateMany({
      where: {
        id,
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        status: { in: ['QUEUED', 'READY', 'GENERATING'] },
      },
      data: {
        status: 'SKIPPED',
        generationToken: null,
        generationStartedAt: null,
        generationLeaseUntil: null,
        generationTtsSignature: null,
      },
    })
    kickAnnouncerWorker()
    return NextResponse.json({ ok: true }, { headers: announcerHeaders })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}
