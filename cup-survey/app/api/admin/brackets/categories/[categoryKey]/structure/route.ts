import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import {
  getAdminBracketCategoryStructure,
  getAdminLiveCategoryStructure,
} from '@/lib/brackets/service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ categoryKey: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const { categoryKey } = await params
    const decodedKey = decodeURIComponent(categoryKey)
    const live = new URL(request.url).searchParams.get('live') === '1'
    const data = live
      ? await getAdminLiveCategoryStructure(decodedKey)
      : await getAdminBracketCategoryStructure(decodedKey)
    if (!data) {
      return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.NOT_FOUND }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
