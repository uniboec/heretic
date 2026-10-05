import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { requireAnnouncerAdmin } from '@/lib/announcer/adminAuth'
import { announcerHeaders } from '@/lib/announcer/routeConfig'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _request: Request,
  context: { params: Promise<{ cacheKey: string }> },
) {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const { cacheKey } = await context.params
    const row = await prisma.announcerAudioCache.findUnique({ where: { cacheKey } })
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const buffer = await readFile(row.filePath)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        ...announcerHeaders,
        'Content-Type': row.mimeType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
