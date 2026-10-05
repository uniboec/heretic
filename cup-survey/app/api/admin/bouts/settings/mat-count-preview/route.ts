import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { previewMatCountChange } from '@/lib/bouts/matCountChange'
import { NO_STORE_HEADERS } from '@/lib/bouts/routeSegmentConfig'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PreviewQuerySchema = z
  .object({
    matCount: z.coerce.number().int().min(1).max(3),
    draftId: z.string(),
    expectedVersion: z.coerce.number().int(),
  })
  .strict()

export async function GET(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const parsed = PreviewQuerySchema.safeParse({
      matCount: url.searchParams.get('matCount'),
      draftId: url.searchParams.get('draftId'),
      expectedVersion: url.searchParams.get('expectedVersion'),
    })
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        { status: 400 },
      )
    }

    const preview = await previewMatCountChange({
      newMatCount: parsed.data.matCount,
      draftId: parsed.data.draftId,
      expectedVersion: parsed.data.expectedVersion,
    })
    return NextResponse.json({ ok: true, ...preview }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
