import { NextResponse } from 'next/server'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { announcerErrorResponse, claimCodeStatus } from '@/lib/announcer/api'
import { requireAnnouncerAdmin } from '@/lib/announcer/adminAuth'
import { claimForPlayback } from '@/lib/announcer/claimPlayback'
import { waitUntilEventAudioReady } from '@/lib/announcer/processor'
import { announcerHeaders } from '@/lib/announcer/routeConfig'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const event = await prisma.announcerEvent.findFirst({
      where: { id, tournamentScopeId: TOURNAMENT_SCOPE_ID },
      select: { status: true, audioCacheKey: true },
    })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404, headers: announcerHeaders })
    }
    if (event.status !== 'READY' || !event.audioCacheKey) {
      const ready = await waitUntilEventAudioReady(id)
      if (!ready) {
        return NextResponse.json(
          { code: 'NOT_READY', error: 'Аудио ещё не готово' },
          { status: 409, headers: announcerHeaders },
        )
      }
    }

    const result = await claimForPlayback({
      scopeId: TOURNAMENT_SCOPE_ID,
      eventId: id,
    })
    if (!result.ok) {
      const status = result.code === 'GAP_ACTIVE' ? 409 : claimCodeStatus(result.code)
      return NextResponse.json(
        {
          code: result.code,
          error:
            result.code === 'GAP_ACTIVE'
              ? 'Пауза между объявлениями ещё активна'
              : result.code === 'DISABLED'
                ? 'Информатор выключен'
                : result.code === 'ALREADY_PLAYING'
                  ? 'Уже воспроизводится другое объявление'
                  : 'Не удалось начать воспроизведение',
        },
        { status, headers: announcerHeaders },
      )
    }
    return NextResponse.json({ snapshot: result.snapshot }, { headers: announcerHeaders })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}
