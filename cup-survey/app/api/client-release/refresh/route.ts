import { NextRequest, NextResponse } from 'next/server'
import { absoluteSiteUrl } from '@/lib/siteUrl'

function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

export async function GET(request: NextRequest) {
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get('return'))
  const response = NextResponse.redirect(absoluteSiteUrl(returnTo))

  response.headers.set('Clear-Site-Data', '"cache"')
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')

  return response
}
