import { getMatScoreboardSnapshot } from '@/lib/bouts/matScoreboardSnapshot'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _request: Request,
  context: { params: Promise<{ matIndex: string }> },
) {
  try {
    const { matIndex } = await context.params
    const parsed = Number.parseInt(matIndex, 10)
    if (!Number.isFinite(parsed) || parsed < 1) {
      return matControlJson({ error: 'Invalid matIndex' }, 400)
    }

    const snapshot = await getMatScoreboardSnapshot(parsed)
    return matControlJson(snapshot)
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
