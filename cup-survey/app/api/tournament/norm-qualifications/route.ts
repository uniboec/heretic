import { NextResponse } from 'next/server'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { getPublicNormQualifications } from '@/lib/rankQualifications/service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getPublicNormQualifications()
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
