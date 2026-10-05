import { verifyMatControlSession } from '@/lib/auth'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { BoutSessionReclaimSchema } from '@/lib/bouts/matControlSchemas'
import { prisma } from '@/lib/prisma'
import {
  BoutSessionReclaimForbiddenError,
  reclaimBoutSession,
} from '@/lib/bouts/matControlReliability/ownership'

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
    const parsed = BoutSessionReclaimSchema.safeParse(body)
    if (!parsed.success) {
      return matControlJson({ errors: parsed.error.issues }, 400)
    }

    await prisma.$transaction((tx) =>
      reclaimBoutSession(tx, {
        boutId,
        boutSessionId: parsed.data.boutSessionId,
        status: parsed.data.status,
        reason: parsed.data.reason,
      }),
    )

    return matControlJson({ ok: true, status: parsed.data.status })
  } catch (error) {
    if (error instanceof BoutSessionReclaimForbiddenError) {
      return matControlJson({ error: error.message, code: error.code }, 409)
    }
    return matControlErrorResponse(error)
  }
}
