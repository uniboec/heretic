'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { withBasePath } from '@/lib/basePath'
import { getAdminNavItems, normalizeAppPath, findActiveNavItem } from '@/lib/navigation'
import { cn } from '@/lib/cn'
import { adminNav, adminNavLink, adminNavLinkActive } from '@/lib/ui/adminSurfaceStyles'

export function AdminNav() {
  const pathname = usePathname()
  const normalizedPath = normalizeAppPath(pathname ?? '/')
  const navItems = getAdminNavItems()
  const activeNavItem = findActiveNavItem(navItems, normalizedPath)

  return (
    <nav className={adminNav} aria-label="Разделы админки">
      {navItems.map((item) => {
        const active = activeNavItem?.id === item.id
        return (
          <Link
            key={item.id}
            href={withBasePath(item.href)}
            className={cn(adminNavLink, active && adminNavLinkActive)}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
