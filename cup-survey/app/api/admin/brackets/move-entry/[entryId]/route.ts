import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { resetBracketEntryPlacement } from '@/lib/brackets/service'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const { entryId } = await params
    const url = new URL(request.url)
    const body = await request.json().catch(() => ({}))
    const draftId =
      (body as { draftId?: string }).draftId ?? url.searchParams.get('draftId') ?? undefined
    const expectedVersionRaw =
      (body as { expectedVersion?: number }).expectedVersion ??
      url.searchParams.get('expectedVersion')
    const expectedVersion =
      expectedVersionRaw != null ? Number(expectedVersionRaw) : undefined
    if (!draftId || expectedVersion == null || Number.isNaN(expectedVersion)) {
      return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.INVALID_BODY }, { status: 400 })
    }
    const result = await resetBracketEntryPlacement({
      entryId,
      draftId,
      expectedVersion,
    })
    return NextResponse.json(result)
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
