import { verifyAdminSession } from '@/lib/auth'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { previewBoutResultCorrection } from '@/lib/bouts/applyBoutResultCorrection'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PreviewSchema = z.object({
  newWinnerEntryId: z.string().nullable(),
  systemId: z.string(),
  categoryKey: z.string(),
  downstreamBoutIds: z.array(z.string()).default([]),
})

export async function GET(
  request: Request,
  context: { params: Promise<{ boutId: string }> },
) {
  if (!(await verifyAdminSession())) {
    return matControlJson({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, 401)
  }

  try {
    const { boutId } = await context.params
    const url = new URL(request.url)
    const parsed = PreviewSchema.safeParse({
      newWinnerEntryId: url.searchParams.get('newWinnerEntryId'),
      systemId: url.searchParams.get('systemId'),
      categoryKey: url.searchParams.get('categoryKey'),
      downstreamBoutIds: url.searchParams.getAll('downstreamBoutId'),
    })
    if (!parsed.success) {
      return matControlJson(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        400,
      )
    }

    const preview = await previewBoutResultCorrection({
      boutId,
      ...parsed.data,
    })
    return matControlJson(preview)
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
