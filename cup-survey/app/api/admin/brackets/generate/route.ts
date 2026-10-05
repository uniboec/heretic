import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { redrawBracketDraft, syncBracketDraft } from '@/lib/brackets/service'

export const maxDuration = 600

export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { draftId, expectedVersion, scope, categoryKey, mode, onlyStale } = body as {
      draftId: string
      expectedVersion: number
      scope: 'all' | 'category'
      categoryKey?: string
      mode: 'SYNC' | 'REDRAW'
      onlyStale?: boolean
    }

    if (!draftId || expectedVersion === undefined || !scope || !mode) {
      return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.INVALID_BODY }, { status: 400 })
    }

    const result =
      mode === 'SYNC'
        ? await syncBracketDraft({ draftId, expectedVersion, scope, categoryKey })
        : await redrawBracketDraft({
            draftId,
            expectedVersion,
            scope,
            categoryKey,
            onlyStale: scope === 'all' ? (onlyStale ?? false) : false,
          })

    return NextResponse.json(result)
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
