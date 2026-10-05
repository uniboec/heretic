import { verifyMatControlSession } from '@/lib/auth'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { BoutMutationEnvelopeSchema } from '@/lib/bouts/matControlSchemas'
import { moveBoutToMat } from '@/lib/bouts/moveBoutToMat'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MoveMatSchema = BoutMutationEnvelopeSchema.extend({
  targetMatIndex: z.number().int().min(1),
  reason: z.string().optional(),
  movedBy: z.string().optional(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ boutId: string }> },
) {
  if (!(await verifyMatControlSession())) {
    return matControlJson({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, 401)
  }

  try {
    const { boutId } = await context.params
    const body = await request.json()
    const parsed = MoveMatSchema.safeParse(body)
    if (!parsed.success) {
      return matControlJson(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        400,
      )
    }

    const result = await moveBoutToMat({
      boutId,
      targetMatIndex: parsed.data.targetMatIndex,
      holderToken: parsed.data.holderToken,
      expectedLiveRevision: parsed.data.expectedLiveRevision,
      expectedAttemptNumber: parsed.data.expectedAttemptNumber,
      reason: parsed.data.reason,
      movedBy: parsed.data.movedBy,
    })

    return matControlJson(result)
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
