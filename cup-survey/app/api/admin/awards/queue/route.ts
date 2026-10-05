import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { awardsErrorResponse } from '@/lib/awards/api'
import { reorderQueueCategory } from '@/lib/awards/mutations'
import { QueueReorderSchema } from '@/lib/awards/schemas'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { NO_STORE_HEADERS } from '@/lib/bouts/routeSegmentConfig'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = QueueReorderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        { status: 400 },
      )
    }
    const result = await reorderQueueCategory(parsed.data)
    return NextResponse.json(result, { headers: NO_STORE_HEADERS })
  } catch (error) {
    return awardsErrorResponse(error)
  }
}
