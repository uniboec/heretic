import { verifyAdminSession } from '@/lib/auth'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { resolveMatControlAuditEntry } from '@/lib/bouts/matControlAudit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(
  request: Request,
  context: { params: Promise<{ entryId: string }> },
) {
  if (!(await verifyAdminSession())) {
    return matControlJson({ error: 'Unauthorized' }, 401)
  }

  try {
    const { entryId } = await context.params
    const body = (await request.json()) as { resolutionNote?: string }
    const entry = await resolveMatControlAuditEntry({
      entryId,
      resolvedBy: 'admin',
      resolutionNote: body.resolutionNote ?? '',
    })
    return matControlJson({ entry })
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
