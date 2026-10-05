import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const { entryId } = await params
    const audit = await prisma.bracketMoveAudit.findMany({
      where: { entryId },
      orderBy: { movedAt: 'desc' },
    })

    return NextResponse.json({ audit })
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
