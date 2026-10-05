import { NextResponse } from 'next/server'
import { getClientReleaseId } from '@/lib/clientRelease'

export const dynamic = 'force-dynamic'

export async function GET() {
  const releaseId = getClientReleaseId()

  return NextResponse.json(
    { releaseId },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  )
}
