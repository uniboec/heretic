import { NextResponse } from 'next/server'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { getPublicResults } from '@/lib/brackets/service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getPublicResults()
    if (!data) {
      return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.NOT_FOUND }, { status: 404 })
    }
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
