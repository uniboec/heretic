import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import { YandexMetrika } from '@/components/analytics/YandexMetrika'
import { ClientReleaseSync } from '@/components/ClientReleaseSync'
import './globals.css'
import { withBasePath } from '@/lib/basePath'
import { getClientAssetRecoveryScript } from '@/lib/clientAssetRecoveryScript'
import { getClientReleaseId } from '@/lib/clientRelease'

export const revalidate = 300

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap',
})

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Кубок Свердловской области по смешанным единоборствам — регистрация 2026',
  description:
    'Регистрация на Кубок Свердловской области по смешанным единоборствам 2026: 3 октября, Первоуральск, Tactic-Control и Close-Control',
  robots: { index: false, follow: false },
  other: {
    google: 'notranslate',
  },
  icons: {
    icon: withBasePath('/images/fse-federation.png'),
    apple: withBasePath('/images/fse-federation.png'),
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const releaseId = getClientReleaseId()
  const assetRecoveryScript = getClientAssetRecoveryScript(releaseId)

  return (
    <html lang="ru" translate="no" className={`${manrope.variable} notranslate`} suppressHydrationWarning>
      <head>
        <meta name="cup-release-id" content={releaseId} />
      </head>
      <body className="min-h-screen antialiased notranslate">
        <script dangerouslySetInnerHTML={{ __html: assetRecoveryScript }} />
        <ClientReleaseSync />
        {children}
        <YandexMetrika />
      </body>
    </html>
  )
}
