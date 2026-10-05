const YANDEX_METRIKA_HTTP = [
  'https://mc.yandex.ru',
  'https://mc.webvisor.com',
  'https://mc.webvisor.org',
  'https://yastatic.net',
]

const YANDEX_METRIKA_CONNECT = [
  "'self'",
  ...YANDEX_METRIKA_HTTP,
  'wss://mc.yandex.ru',
  'wss://mc.webvisor.com',
  'wss://mc.webvisor.org',
]

const YANDEX_METRIKA_FRAME_SRC = ["'self'", 'blob:', ...YANDEX_METRIKA_HTTP]

/** Domains where Metrika Webvisor can embed the site for session playback. */
const YANDEX_METRIKA_FRAME_ANCESTORS = [
  "'self'",
  'https://metrika.yandex.ru',
  'https://metrika.yandex.com',
  'https://metrica.yandex.ru',
  'https://metrica.yandex.com',
  'https://metr.yandex.ru',
  'https://webvisor.com',
]

export function buildContentSecurityPolicy(includeUnsafeEval: boolean): string {
  const scriptSrc = [
    'script-src',
    "'self'",
    "'unsafe-inline'",
    ...(includeUnsafeEval ? ["'unsafe-eval'"] : []),
    ...YANDEX_METRIKA_HTTP,
  ].join(' ')

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${YANDEX_METRIKA_FRAME_ANCESTORS.join(' ')}`,
    `frame-src ${YANDEX_METRIKA_FRAME_SRC.join(' ')}`,
    "object-src 'none'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${YANDEX_METRIKA_HTTP.join(' ')}`,
    "font-src 'self' data:",
    `connect-src ${YANDEX_METRIKA_CONNECT.join(' ')}`,
  ].join('; ')
}

export function getAppSecurityHeaders() {
  const isDev = process.env.NODE_ENV === 'development'

  return [
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=()',
    },
    {
      key: 'Content-Security-Policy',
      value: buildContentSecurityPolicy(isDev),
    },
  ]
}

/** Production CSP without unsafe-eval (keep deploy/nginx-security-headers.conf in sync). */
export const productionContentSecurityPolicy = buildContentSecurityPolicy(false)

/** Production CSP without unsafe-eval (nginx uses the same policy). */
export const appSecurityHeaders = getAppSecurityHeaders()

export const hstsHeader = {
  key: 'Strict-Transport-Security',
  value: 'max-age=31536000',
} as const
