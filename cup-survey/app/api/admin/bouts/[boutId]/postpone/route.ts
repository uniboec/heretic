import { verifyMatControlSession } from '@/lib/auth'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { BoutMutationEnvelopeSchema } from '@/lib/bouts/matControlSchemas'
import { ExpectedScheduleVersionSchema } from '@/lib/bouts/schemas'
import { postponeBoutOnMat } from '@/lib/bouts/postponeBout'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PostponeSchema = BoutMutationEnvelopeSchema.merge(ExpectedScheduleVersionSchema).extend({
  postponeAfterBoutId: z.string().min(1).optional(),
  postponeBy: z.number().int().min(1).max(50).optional(),
  reason: z.string().optional(),
  postponedBy: z.string().optional(),
}).superRefine((value, ctx) => {
  if (!value.postponeAfterBoutId && value.postponeBy == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Укажите postponeAfterBoutId или postponeBy',
      path: ['postponeBy'],
    })
  }
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
    const parsed = PostponeSchema.safeParse(body)
    if (!parsed.success) {
      return matControlJson(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        400,
      )
    }

    const result = await postponeBoutOnMat({
      boutId,
      postponeAfterBoutId: parsed.data.postponeAfterBoutId,
      postponeBy: parsed.data.postponeBy,
      holderToken: parsed.data.holderToken,
      expectedLiveRevision: parsed.data.expectedLiveRevision,
      expectedAttemptNumber: parsed.data.expectedAttemptNumber,
      expectedScheduleVersion: parsed.data.expectedScheduleVersion,
      reason: parsed.data.reason,
      postponedBy: parsed.data.postponedBy,
    })

    return matControlJson(result)
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
