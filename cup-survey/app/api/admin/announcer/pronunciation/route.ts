import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { announcerErrorResponse } from '@/lib/announcer/api'
import { requireAnnouncerAdmin } from '@/lib/announcer/adminAuth'
import { announcerHeaders } from '@/lib/announcer/routeConfig'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PronunciationPatchSchema = z.object({
  sourceText: z.string().min(1).max(200),
  spokenText: z.string().min(1).max(200),
})

const PronunciationUpdateSchema = z.object({
  originalSourceText: z.string().min(1).max(200),
  sourceText: z.string().min(1).max(200),
  spokenText: z.string().min(1).max(200),
})

export async function GET() {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const rows = await prisma.announcerPronunciation.findMany({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
      orderBy: { sourceText: 'asc' },
    })
    return NextResponse.json({ items: rows }, { headers: announcerHeaders })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = PronunciationPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const item = await prisma.announcerPronunciation.upsert({
      where: {
        tournamentScopeId_sourceText: {
          tournamentScopeId: TOURNAMENT_SCOPE_ID,
          sourceText: parsed.data.sourceText,
        },
      },
      create: {
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        sourceText: parsed.data.sourceText,
        spokenText: parsed.data.spokenText,
      },
      update: { spokenText: parsed.data.spokenText },
    })
    return NextResponse.json({ item }, { headers: announcerHeaders })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = PronunciationUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const { originalSourceText, sourceText, spokenText } = parsed.data

    if (originalSourceText === sourceText) {
      const item = await prisma.announcerPronunciation.update({
        where: {
          tournamentScopeId_sourceText: {
            tournamentScopeId: TOURNAMENT_SCOPE_ID,
            sourceText,
          },
        },
        data: { spokenText },
      })
      return NextResponse.json({ item }, { headers: announcerHeaders })
    }

    const existing = await prisma.announcerPronunciation.findUnique({
      where: {
        tournamentScopeId_sourceText: {
          tournamentScopeId: TOURNAMENT_SCOPE_ID,
          sourceText: originalSourceText,
        },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    const item = await prisma.$transaction(async (tx) => {
      await tx.announcerPronunciation.delete({
        where: {
          tournamentScopeId_sourceText: {
            tournamentScopeId: TOURNAMENT_SCOPE_ID,
            sourceText: originalSourceText,
          },
        },
      })
      return tx.announcerPronunciation.create({
        data: {
          tournamentScopeId: TOURNAMENT_SCOPE_ID,
          sourceText,
          spokenText,
        },
      })
    })

    return NextResponse.json({ item }, { headers: announcerHeaders })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const sourceText = body.sourceText as string | undefined
    if (!sourceText) {
      return NextResponse.json({ error: 'sourceText required' }, { status: 400 })
    }
    await prisma.announcerPronunciation.deleteMany({
      where: { tournamentScopeId: TOURNAMENT_SCOPE_ID, sourceText },
    })
    return NextResponse.json({ ok: true }, { headers: announcerHeaders })
  } catch (error) {
    return announcerErrorResponse(error)
  }
}
