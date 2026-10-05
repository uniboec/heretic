'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { findActiveNavItem, getPublicNavItems, normalizeAppPath } from '@/lib/navigation'
import { routes } from '@/lib/routes'
import { tournamentInfo } from '@/lib/config/tournament'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import {
  eventBurgerButton,
  eventBurgerLine,
  eventFooterContactSep,
  eventFooterContacts,
  eventShellContainer,
  eventShellHeader,
  eventShellHeaderBrandLink,
  eventShellHeaderBrandRow,
  eventShellHeaderBrandSubtitle,
  eventShellHeaderBrandTitle,
  eventShellHeaderMobileBar,
  eventShellHeaderNavRow,
  eventShellHeaderNavSection,
  eventShellLayout,
  eventShellMain,
  eventShellNavLink,
} from '@/lib/ui/eventSurfaceStyles'
import { EventBrandLogo } from './EventBrandLogo'
import { TournamentMobileMenu } from './TournamentMobileMenu'
import type { TournamentShellState } from '@/lib/tournament/shellState'
import { BracketCategoryViewerProvider } from '@/components/tournament/brackets/BracketCategoryViewerProvider'

export function TournamentShell({
  children,
  initialState,
}: {
  children: React.ReactNode
  initialState: TournamentShellState
}) {
  const pathname = usePathname()
  const normalizedPath = normalizeAppPath(pathname ?? '/')
  const [entryCount, setEntryCount] = useState<number | null>(initialState.entryCount)
  const [closed, setClosed] = useState(initialState.closed)
  const [bracketsPublicEnabled, setBracketsPublicEnabled] = useState(initialState.bracketsPublicEnabled)
  const [boutsPublicEnabled, setBoutsPublicEnabled] = useState(initialState.boutsPublicEnabled)
  const [awardsPublicEnabled, setAwardsPublicEnabled] = useState(initialState.awardsPublicEnabled)
  const [normQualificationsPublicEnabled, setNormQualificationsPublicEnabled] = useState(
    initialState.normQualificationsPublicEnabled,
  )
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    fetch(withBasePath('/api/tournament/state'))
      .then((response) =>
        readJsonResponse<{
          stats?: { entries?: number }
          closed?: boolean
          bracketsPublicEnabled?: boolean
          boutsPublicEnabled?: boolean
          awardsPublicEnabled?: boolean
          normQualificationsPublicEnabled?: boolean
        }>(response),
      )
      .then((result) => {
        if (!result.ok) return
        const json = result.data
        setEntryCount(json.stats?.entries ?? 0)
        setClosed(Boolean(json.closed))
        setBracketsPublicEnabled(Boolean(json.bracketsPublicEnabled))
        setBoutsPublicEnabled(Boolean(json.boutsPublicEnabled))
        setAwardsPublicEnabled(Boolean(json.awardsPublicEnabled))
        setNormQualificationsPublicEnabled(Boolean(json.normQualificationsPublicEnabled))
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => {
      if (mq.matches) setMenuOpen(false)
    }
    mq.addEventListener('change', closeOnDesktop)
    return () => mq.removeEventListener('change', closeOnDesktop)
  }, [])

  const navItems = getPublicNavItems({
    bracketsPublicEnabled,
    boutsPublicEnabled,
    awardsPublicEnabled,
    normQualificationsPublicEnabled,
    currentPath: normalizedPath,
  })
  const activeNavItem = findActiveNavItem(navItems, normalizedPath)

  return (
    <BracketCategoryViewerProvider>
    <div className={eventShellLayout}>
      <header className={eventShellHeader}>
        <div className={cn(eventShellContainer, eventShellHeaderMobileBar)}>
          <Link href={withBasePath('/')} className={cn(eventShellHeaderBrandLink, 'min-w-0 flex-1')}>
            <EventBrandLogo size="sm" />
            <div className="min-w-0 leading-tight">
              <p className={eventShellHeaderBrandTitle}>Кубок ФСЕ СО</p>
              <p className={eventShellHeaderBrandSubtitle}>{tournamentInfo.venue.city}</p>
            </div>
          </Link>

          <Button
            type="button"
            variant="ghost"
            className={eventBurgerButton(menuOpen)}
            aria-expanded={menuOpen}
            aria-controls="event-mobile-menu"
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className={eventBurgerLine(menuOpen, 1)} />
            <span className={eventBurgerLine(menuOpen, 2)} />
            <span className={eventBurgerLine(menuOpen, 3)} />
          </Button>
        </div>

        <div className={cn(eventShellContainer, eventShellHeaderNavSection)}>
          <div className={eventShellHeaderBrandRow}>
            <Link href={withBasePath('/')} className={eventShellHeaderBrandLink}>
              <EventBrandLogo size="sm" />
              <div className="min-w-0 leading-tight">
                <p className={eventShellHeaderBrandTitle}>Кубок Свердловской области</p>
                <p className={eventShellHeaderBrandSubtitle}>
                  смешанные единоборства · {tournamentInfo.venue.city}
                </p>
              </div>
            </Link>

            {!closed && (
              <Link href={withBasePath(routes.register)} className="shrink-0">
                <Button className="min-h-10 shadow-sm">Зарегистрироваться</Button>
              </Link>
            )}
          </div>

          <nav className={eventShellHeaderNavRow} aria-label="Разделы турнира">
            {navItems.map((item) => {
              const active = activeNavItem?.id === item.id
              return (
                <Link
                  key={item.id}
                  href={withBasePath(item.href)}
                  className={eventShellNavLink(active)}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                  {item.id === 'athletes' && entryCount != null && entryCount > 0 && (
                    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-surface px-1.5 py-0.5 text-xs font-semibold text-foreground">
                      {entryCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <TournamentMobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        normalizedPath={normalizedPath}
        closed={closed}
        entryCount={entryCount}
        navItems={navItems}
        activeNavItem={activeNavItem}
      />

      <main className={cn(eventShellContainer, eventShellMain)}>{children}</main>

      <footer className="border-t border-border bg-white py-4 sm:py-6">
        <div
          className={cn(
            eventShellContainer,
            'flex flex-col gap-2 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:text-sm',
          )}
        >
          <p>
            {tournamentInfo.eventDateLabel} · {tournamentInfo.venue.city}
          </p>
          <p className={eventFooterContacts}>
            <a href={`tel:${tournamentInfo.contacts.phone.replace(/[^\d+]/g, '')}`} className="hover:text-accent">
              {tournamentInfo.contacts.phone}
            </a>
            <span className={eventFooterContactSep} aria-hidden="true">·</span>
            <a href={`mailto:${tournamentInfo.contacts.email}`} className="hover:text-accent">
              {tournamentInfo.contacts.email}
            </a>
            <span className={eventFooterContactSep} aria-hidden="true">·</span>
            <a
              href={tournamentInfo.contacts.vk}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent"
            >
              {tournamentInfo.contacts.vkLabel}
            </a>
          </p>
        </div>
      </footer>
    </div>
    </BracketCategoryViewerProvider>
  )
}
