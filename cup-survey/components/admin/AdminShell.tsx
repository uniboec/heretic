'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { withBasePath } from '@/lib/basePath'
import { getAdminPageTitle, normalizeAppPath } from '@/lib/navigation'
import {
  adminShellContainer,
  adminShellHeader,
  adminShellHeaderLink,
  adminShellLayout,
  adminShellMain,
} from '@/lib/ui/adminSurfaceStyles'
import { AdminNav } from './AdminNav'
import { BracketCategoryViewerProvider } from '@/components/tournament/brackets/BracketCategoryViewerProvider'

export function AdminShell({
  children,
  showNav = true,
  judgeMode = false,
}: {
  children: React.ReactNode
  showNav?: boolean
  judgeMode?: boolean
}) {
  const pathname = usePathname()
  const normalizedPath = normalizeAppPath(pathname ?? '/')
  const currentPageTitle = getAdminPageTitle(normalizedPath)

  if (judgeMode) {
    return (
      <BracketCategoryViewerProvider>
        <div className="min-h-dvh w-full bg-background">{children}</div>
      </BracketCategoryViewerProvider>
    )
  }

  return (
    <BracketCategoryViewerProvider>
    <div className={adminShellLayout}>
      <header className={adminShellHeader}>
        <div className={`${adminShellContainer} flex items-center justify-between gap-3 py-3 sm:py-4`}>
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src={withBasePath('/images/fse-federation.png')}
              alt="ФСЕ СО"
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 object-contain"
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold text-foreground sm:text-base">Админ-панель</p>
              <p className="truncate text-xs text-muted">
                {currentPageTitle
                  ? `Раздел: ${currentPageTitle}`
                  : 'Кубок Свердловской области · 2026'}
              </p>
            </div>
          </div>
          <Link href={withBasePath('/')} className={adminShellHeaderLink}>
            На сайт →
          </Link>
        </div>
        {showNav ? (
          <div className={`${adminShellContainer} pb-0`}>
            <AdminNav />
          </div>
        ) : null}
      </header>

      <main className={adminShellMain}>{children}</main>
    </div>
    </BracketCategoryViewerProvider>
  )
}
