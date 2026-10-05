import { getAdminSessionRole, verifyMatControlSession } from '@/lib/auth'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { MatSessionAcquireSchema } from '@/lib/bouts/matControlSchemas'
import { focusMatBout } from '@/lib/bouts/matControlService'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const FocusBodySchema = MatSessionAcquireSchema.extend({
  boutId: z.string().min(1),
})

function parseMatIndex(matIndex: string): number | null {
  const parsed = Number.parseInt(matIndex, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return null
  return parsed
}

export async function POST(
  request: Request,
  context: { params: Promise<{ matIndex: string }> },
) {
  if (!(await verifyMatControlSession())) {
    return matControlJson({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, 401)
  }

  try {
    const { matIndex } = await context.params
    const parsedMat = parseMatIndex(matIndex)
    if (parsedMat == null) {
      return matControlJson({ error: 'Invalid matIndex' }, 400)
    }

    const body = await request.json().catch(() => null)
    const parsedBody = FocusBodySchema.safeParse(body)
    if (!parsedBody.success) {
      return matControlJson({ error: 'Некорректные параметры запроса' }, 400)
    }

    const role = (await getAdminSessionRole()) ?? 'admin'
    const snapshot = await focusMatBout({
      matIndex: parsedMat,
      boutId: parsedBody.data.boutId,
      holderToken: parsedBody.data.holderToken,
      sessionRole: role,
    })

    return matControlJson(snapshot)
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
