import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'

export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  return NextResponse.json(
    { code: 'PUBLISH_REMOVED', error: 'Publish flow removed in ACTIVE-only mode' },
    { status: 410 },
  )
}
