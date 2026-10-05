import { NextResponse } from 'next/server'
import { awardsErrorResponse } from '@/lib/awards/api'
import { getPublicAwards } from '@/lib/awards/service'
import { NO_STORE_HEADERS } from '@/lib/bouts/routeSegmentConfig'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const data = await getPublicAwards()
    if (data === null) {
      return NextResponse.json(
        { error: 'NOT_FOUND' },
        { status: 404, headers: NO_STORE_HEADERS },
      )
    }
    return NextResponse.json(data, { headers: NO_STORE_HEADERS })
  } catch (error) {
    return awardsErrorResponse(error)
  }
}
