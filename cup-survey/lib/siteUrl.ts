export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000'
  return url.replace(/\/$/, '')
}

export function absoluteSiteUrl(path: string): URL {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return new URL(normalized, `${getSiteUrl()}/`)
}
