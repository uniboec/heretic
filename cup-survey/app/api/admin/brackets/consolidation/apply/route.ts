import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { applyConsolidation } from '@/lib/brackets/consolidation/apply'
import { validateConsolidationPolicy } from '@/lib/brackets/consolidation/policyHash'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { computeDiffForDraft } from '@/lib/brackets/dashboardDiff'
import { buildCategoriesCanonicalDto } from '@/lib/brackets/admin/categoryCanonical'

export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { expectedVersion, policy: rawPolicy, consolidationPlanToken, impactToken } = body as {
      expectedVersion: number
      policy?: unknown
      consolidationPlanToken?: string
      impactToken?: string
    }

    if (expectedVersion === undefined || !consolidationPlanToken) {
      return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.INVALID_BODY }, { status: 400 })
    }

    const policy = validateConsolidationPolicy(rawPolicy)
    if (!policy) {
      return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.INVALID_BODY }, { status: 400 })
    }

    const result = await applyConsolidation({
      expectedVersion,
      policy,
      consolidationPlanToken,
      impactToken,
    })

    const diff = await computeDiffForDraft(result.draft.id)
    const categories = await buildCategoriesCanonicalDto(
      result.draft.id,
      result.affectedCategoryKeys,
    )

    return NextResponse.json({
      ...result,
      diff,
      categories,
    })
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
