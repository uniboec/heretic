import { verifyAdminSession } from '@/lib/auth'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { getAdminBoutPanelOverview } from '@/lib/bouts/getAdminBoutPanelOverview'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _request: Request,
  context: { params: Promise<{ boutId: string }> },
) {
  if (!(await verifyAdminSession())) {
    return matControlJson({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, 401)
  }

  try {
    const { boutId } = await context.params
    const panel = await getAdminBoutPanelOverview(boutId)
    return matControlJson({ panel })
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
