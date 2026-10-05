import { verifyMatControlSession } from '@/lib/auth'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { MatControlCommandSchema } from '@/lib/bouts/matControlSchemas'
import { executeMatControlCommand } from '@/lib/bouts/matControlService'
import type { ControlIntent } from '@/lib/bouts/mat-control/types'

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
    const parsed = MatControlCommandSchema.safeParse(body)
    if (!parsed.success) {
      return matControlJson(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        400,
      )
    }

    const result = await executeMatControlCommand({
      boutId,
      envelope: {
        operationId: parsed.data.operationId,
        holderToken: parsed.data.holderToken,
        expectedLiveRevision: parsed.data.expectedLiveRevision,
        expectedAttemptNumber: parsed.data.expectedAttemptNumber,
        reliability: parsed.data.reliability,
      },
      intent: parsed.data.intent as ControlIntent,
      payload: parsed.data.payload,
      expectedScheduleVersion: parsed.data.expectedScheduleVersion,
    })

    return matControlJson(result)
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
