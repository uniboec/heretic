import { verifyMatControlSession } from '@/lib/auth'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { executeCommitBoutPackage } from '@/lib/bouts/matControlService'
import { CommitBoutPackageSchema } from '@/lib/bouts/matControlSchemas'

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
    const parsed = CommitBoutPackageSchema.safeParse(body)
    if (!parsed.success) {
      return matControlJson({ errors: parsed.error.issues }, 400)
    }

    const result = await executeCommitBoutPackage({
      boutId,
      package: parsed.data,
    })
    return matControlJson(result)
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
