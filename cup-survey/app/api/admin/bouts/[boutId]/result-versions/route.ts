import { verifyAdminSession } from '@/lib/auth'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { listBoutResultVersions } from '@/lib/bouts/boutResultQueries'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { prisma } from '@/lib/prisma'

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
    const versions = await listBoutResultVersions(prisma, boutId)
    return matControlJson({ versions })
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
