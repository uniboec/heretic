import { verifyMatControlSession } from '@/lib/auth'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { BoutSessionHeartbeatSchema } from '@/lib/bouts/matControlSchemas'
import { prisma } from '@/lib/prisma'
import {
  markStaleSessionsFromHeartbeatTimeout,
  SessionSupersededError,
  touchBoutSessionHeartbeat,
} from '@/lib/bouts/matControlReliability/ownership'
import { SessionSupersededError as SessionSupersededApiError } from '@/lib/bouts/mat-control/errors'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(
  request: Request,
  context: { params: Promise<{ boutId: string }> },
) {
  if (!(await verifyMatControlSession())) {
    return matControlJson({ error: 'Unauthorized' }, 401)
  }

  try {
    await context.params
    const body = await request.json()
    const parsed = BoutSessionHeartbeatSchema.safeParse(body)
    if (!parsed.success) {
      return matControlJson({ errors: parsed.error.issues }, 400)
    }

    await prisma.$transaction(async (tx) => {
      await markStaleSessionsFromHeartbeatTimeout(tx)
      await touchBoutSessionHeartbeat(tx, {
        boutSessionId: parsed.data.boutSessionId,
        clientSessionId: parsed.data.clientSessionId,
        ownershipEpoch: parsed.data.ownershipEpoch,
      })
    })

    return matControlJson({ ok: true })
  } catch (error) {
    if (error instanceof SessionSupersededError) {
      return matControlErrorResponse(new SessionSupersededApiError(error.message))
    }
    return matControlErrorResponse(error)
  }
}
