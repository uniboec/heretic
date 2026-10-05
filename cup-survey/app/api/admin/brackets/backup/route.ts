import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { createBracketBackup } from '@/lib/brackets/backup/create'
import { listBracketBackups } from '@/lib/brackets/backup/list'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const result = await listBracketBackups()
    return NextResponse.json(result)
  } catch (error) {
    return bracketErrorResponse(error)
  }
}

export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { label } = body as { label?: string }
    const result = await createBracketBackup(label)
    return NextResponse.json(result)
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
