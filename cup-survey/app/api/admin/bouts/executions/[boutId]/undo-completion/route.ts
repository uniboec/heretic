import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { undoBoutCompletion } from '@/lib/bouts/executionMutations'
import { NO_STORE_HEADERS } from '@/lib/bouts/routeSegmentConfig'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const UndoSchema = z
  .object({
    matIndex: z.number().int().min(1).max(3),
  })
  .strict()

export async function POST(
  request: Request,
  context: { params: Promise<{ boutId: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const { boutId } = await context.params
    const body = await request.json()
    const parsed = UndoSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        { status: 400 },
      )
    }
    const result = await undoBoutCompletion({ boutId, matIndex: parsed.data.matIndex })
    return NextResponse.json(result, { headers: NO_STORE_HEADERS })
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
