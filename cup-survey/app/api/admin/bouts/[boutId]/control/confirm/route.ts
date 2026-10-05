import { verifyMatControlSession } from '@/lib/auth'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { BoutMutationEnvelopeSchema } from '@/lib/bouts/matControlSchemas'
import { executeMatControlCommand } from '@/lib/bouts/matControlService'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
    const parsed = BoutMutationEnvelopeSchema.safeParse(body)
    if (!parsed.success) {
      return matControlJson(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        400,
      )
    }

    const result = await executeMatControlCommand({
      boutId,
      envelope: parsed.data,
      intent: 'CONFIRM',
      payload: {},
      expectedScheduleVersion: parsed.data.expectedScheduleVersion,
    })

    return matControlJson(result)
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
