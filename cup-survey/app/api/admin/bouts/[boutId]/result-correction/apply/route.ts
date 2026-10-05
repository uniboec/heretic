import { verifyAdminSession } from '@/lib/auth'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { applyBoutResultCorrection } from '@/lib/bouts/applyBoutResultCorrection'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ApplySchema = z.object({
  operationId: z.string().uuid(),
  reason: z.string().min(1),
  requestedBy: z.string().min(1),
  newWinnerEntryId: z.string().nullable(),
  newLoserEntryId: z.string().nullable(),
  systemId: z.string(),
  categoryKey: z.string(),
  schedulePhase: z.enum(['elimination', 'bronze', 'final', 'round_robin']),
  downstreamBoutIds: z.array(z.string()).default([]),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ boutId: string }> },
) {
  if (!(await verifyAdminSession())) {
    return matControlJson({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, 401)
  }

  try {
    const { boutId } = await context.params
    const body = await request.json()
    const parsed = ApplySchema.safeParse(body)
    if (!parsed.success) {
      return matControlJson(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        400,
      )
    }

    const result = await applyBoutResultCorrection({
      boutId,
      ...parsed.data,
    })
    const { afterBoutResultCorrection } = await import('@/lib/announcer/hooks/afterBoutResultCorrection')
    void afterBoutResultCorrection({ boutId })
    return matControlJson(result)
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
