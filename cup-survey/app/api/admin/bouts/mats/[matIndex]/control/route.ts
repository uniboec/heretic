import { getAdminSessionRole, verifyMatControlSession } from '@/lib/auth'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { getMatControlSnapshot } from '@/lib/bouts/matControlService'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _request: Request,
  context: { params: Promise<{ matIndex: string }> },
) {
  if (!(await verifyMatControlSession())) {
    return matControlJson({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, 401)
  }

  try {
    const { matIndex } = await context.params
    const parsed = Number.parseInt(matIndex, 10)
    if (!Number.isFinite(parsed) || parsed < 1) {
      return matControlJson({ error: 'Invalid matIndex' }, 400)
    }
    const role = (await getAdminSessionRole()) ?? 'admin'
    const snapshot = await getMatControlSnapshot(parsed, role)
    return matControlJson(snapshot)
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
