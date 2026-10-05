import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { setCategoriesPublicVisibility } from '@/lib/brackets/service'

export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { scope, categoryKey, visible, publicVisible } = body as {
      scope: 'all' | 'category'
      categoryKey?: string
      visible?: boolean
      publicVisible?: boolean
    }

    if (!scope || (visible === undefined && publicVisible === undefined)) {
      return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.INVALID_BODY }, { status: 400 })
    }

    const result = await setCategoriesPublicVisibility({
      scope,
      categoryKey,
      visible: visible ?? publicVisible ?? false,
    })

    return NextResponse.json(result)
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
