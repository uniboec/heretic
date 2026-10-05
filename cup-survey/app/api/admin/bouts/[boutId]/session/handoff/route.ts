import { verifyMatControlSession } from '@/lib/auth'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { BoutSessionHandoffSchema } from '@/lib/bouts/matControlSchemas'
import { prisma } from '@/lib/prisma'
import { handoffBoutSession } from '@/lib/bouts/matControlReliability/ownership'

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
    const parsed = BoutSessionHandoffSchema.safeParse(body)
    if (!parsed.success) {
      return matControlJson({ errors: parsed.error.issues }, 400)
    }

    const result = await prisma.$transaction((tx) =>
      handoffBoutSession(tx, {
        boutId,
        boutSessionId: parsed.data.boutSessionId,
        newClientSessionId: parsed.data.newClientSessionId,
        adminId: 'admin',
        reason: parsed.data.reason,
        suffixDisposition: parsed.data.suffixDisposition,
      }),
    )

    return matControlJson(result)
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
