import { verifyMatControlSession } from '@/lib/auth'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { prisma } from '@/lib/prisma'
import {
  BoutAlreadyCommittedError,
  BoutSessionAlreadyActiveError,
} from '@/lib/bouts/matControlReliability/ownership'
import {
  BoutAlreadyCommittedError as BoutAlreadyCommittedApiError,
  BoutSessionAlreadyActiveError as BoutSessionAlreadyActiveApiError,
} from '@/lib/bouts/mat-control/errors'
import { acquireBoutSession } from '@/lib/bouts/matControlReliability/ownership'
import { z } from 'zod'

const AcquireSchema = z.object({
  acquireRequestId: z.string().uuid(),
  clientSessionId: z.string().uuid().optional(),
})

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
    const { boutId } = await context.params
    const body = await request.json()
    const parsed = AcquireSchema.safeParse(body)
    if (!parsed.success) {
      return matControlJson({ errors: parsed.error.issues }, 400)
    }

    const result = await prisma.$transaction((tx) =>
      acquireBoutSession(tx, {
        boutId,
        acquireRequestId: parsed.data.acquireRequestId,
        clientSessionId: parsed.data.clientSessionId,
      }),
    )

    return matControlJson(result)
  } catch (error) {
    if (error instanceof BoutAlreadyCommittedError) {
      return matControlErrorResponse(new BoutAlreadyCommittedApiError(error.message))
    }
    if (error instanceof BoutSessionAlreadyActiveError) {
      return matControlErrorResponse(new BoutSessionAlreadyActiveApiError(error.message))
    }
    return matControlErrorResponse(error)
  }
}
