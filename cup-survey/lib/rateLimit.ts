import { prisma } from './prisma'

const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS = process.env.NODE_ENV === 'development' ? 100 : 5

export async function checkRateLimit(key: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const since = new Date(Date.now() - WINDOW_MS)

  await prisma.rateLimitEntry.deleteMany({
    where: { createdAt: { lt: since } },
  })

  const count = await prisma.rateLimitEntry.count({
    where: { key, createdAt: { gte: since } },
  })

  if (count >= MAX_REQUESTS) {
    const oldest = await prisma.rateLimitEntry.findFirst({
      where: { key, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    })
    const retryAfter = oldest
      ? Math.ceil((oldest.createdAt.getTime() + WINDOW_MS - Date.now()) / 1000)
      : 60
    return { allowed: false, retryAfter }
  }

  await prisma.rateLimitEntry.create({ data: { key } })
  return { allowed: true }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return request.headers.get('x-real-ip') ?? 'unknown'
}

export function isAllowedOrigin(request: Request): boolean {
  const allowed = (process.env.ALLOWED_ORIGINS ?? process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (process.env.NODE_ENV === 'development') {
    allowed.push('http://localhost:3000', 'http://127.0.0.1:3000')
  }

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  if (origin && allowed.some((a) => origin.startsWith(a))) return true
  if (referer && allowed.some((a) => referer.startsWith(a))) return true

  if (!origin && !referer && process.env.NODE_ENV === 'development') return true

  return false
}
