import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_COOKIE_NAME } from '@/lib/auth'
import { absoluteSiteUrl } from '@/lib/siteUrl'

const STATIC_CACHE_PROD = 'public, max-age=31536000, immutable'
const STATIC_CACHE_DEV = 'no-store, no-cache, must-revalidate'
const DOCUMENT_CACHE = 'no-cache, must-revalidate'
const API_CACHE = 'private, no-cache, no-store, must-revalidate'

function withCacheHeaders(request: NextRequest, response: NextResponse) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/_next/static/')) {
    const cacheBusted = request.nextUrl.searchParams.has('cupv')
    response.headers.set(
      'Cache-Control',
      cacheBusted || process.env.NODE_ENV === 'development' ? STATIC_CACHE_DEV : STATIC_CACHE_PROD,
    )
    return response
  }

  if (pathname.startsWith('/api/') || request.nextUrl.searchParams.has('_rsc')) {
    response.headers.set('Cache-Control', API_CACHE)
    return response
  }

  response.headers.set('Cache-Control', DOCUMENT_CACHE)
  return response
}

export function proxy(request: NextRequest) {
  const hostname = request.nextUrl.hostname

  if (
    process.env.NODE_ENV === 'development' &&
    (hostname === '127.0.0.1' || hostname === '0.0.0.0')
  ) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.hostname = 'localhost'
    return NextResponse.redirect(redirectUrl)
  }

  const { pathname } = request.nextUrl

  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
    return withCacheHeaders(request, NextResponse.next())
  }

  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.redirect(absoluteSiteUrl('/admin/login'))
    }
  }

  return withCacheHeaders(request, NextResponse.next())
}

export const config = {
  matcher: ['/((?!_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
