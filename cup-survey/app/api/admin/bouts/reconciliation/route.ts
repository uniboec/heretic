import { verifyAdminSession } from '@/lib/auth'
import { matControlErrorResponse, matControlJson } from '@/lib/bouts/matControlApi'
import {
  backfillFightOfficiallyStarted,
  findFastestFightEligibilityGaps,
  findRatingBracketMismatches,
} from '@/lib/bouts/matControlReconciliation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  if (!(await verifyAdminSession())) {
    return matControlJson({ error: 'Unauthorized' }, 401)
  }

  try {
    const url = new URL(request.url)
    const categoryKey = url.searchParams.get('categoryKey') ?? undefined
    const mismatches = await findRatingBracketMismatches({ categoryKey, limit: 200 })
    const fastestFightGaps = await findFastestFightEligibilityGaps({ limit: 200 })
    return matControlJson({ mismatches, fastestFightGaps })
  } catch (error) {
    return matControlErrorResponse(error)
  }
}

export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return matControlJson({ error: 'Unauthorized' }, 401)
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string
      boutId?: string
      dryRun?: boolean
    }
    if (body.action === 'backfill-fight-officially-started') {
      const result = await backfillFightOfficiallyStarted({
        boutId: body.boutId,
        dryRun: body.dryRun,
      })
      return matControlJson(result)
    }
    return matControlJson({ error: 'Unknown action' }, 400)
  } catch (error) {
    return matControlErrorResponse(error)
  }
}
