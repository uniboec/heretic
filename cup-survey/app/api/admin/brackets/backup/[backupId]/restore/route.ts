import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { restoreBracketBackup } from '@/lib/brackets/backup/restore'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'

export async function POST(
  request: Request,
  context: { params: Promise<{ backupId: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const { backupId } = await context.params
    const body = await request.json()
    const { expectedVersion, impactToken } = body as {
      expectedVersion: number
      impactToken: string
    }

    if (expectedVersion === undefined || !impactToken) {
      return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.INVALID_BODY }, { status: 400 })
    }

    const result = await restoreBracketBackup({ backupId, expectedVersion, impactToken })
    return NextResponse.json(result)
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
