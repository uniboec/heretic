import { NextResponse } from 'next/server'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { getPublicBouts } from '@/lib/bouts/service'
import { NO_STORE_HEADERS } from '@/lib/bouts/routeSegmentConfig'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const data = await getPublicBouts()
    if (data === null) {
      return NextResponse.json(
        { error: 'Раздел поединков недоступен' },
        { status: 404, headers: NO_STORE_HEADERS },
      )
    }
    return NextResponse.json(data, { headers: NO_STORE_HEADERS })
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
