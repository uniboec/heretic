import { NextResponse } from 'next/server'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { getPublicBrackets } from '@/lib/brackets/service'

export async function GET() {
  try {
    const data = await getPublicBrackets()
    if (!data) {
      return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.NOT_FOUND }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
