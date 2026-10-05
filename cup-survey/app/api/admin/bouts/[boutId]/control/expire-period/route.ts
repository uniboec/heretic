import { verifyMatControlSession } from '@/lib/auth'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { BoutMutationEnvelopeSchema } from '@/lib/bouts/matControlSchemas'
import { executeMatControlCommand } from '@/lib/bouts/matControlService'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ExpirePeriodSchema = BoutMutationEnvelopeSchema.extend({
  period: z.enum(['main', 'extra']),
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
    const parsed = ExpirePeriodSchema.safeParse(body)
    if (!parsed.success) {
      return matControlJson(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        400,
      )
    }

    const { period, ...envelope } = parsed.data
    const result = await executeMatControlCommand({
      boutId,
      envelope,
      intent: 'EXPIRE_PERIOD',
      payload: { period },
    })

    return matControlJson(result)
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
