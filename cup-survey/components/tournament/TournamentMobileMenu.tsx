'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { withBasePath } from '@/lib/basePath'
import type { AppNavItem } from '@/lib/navigation'
import { routes } from '@/lib/routes'
import { tournamentInfo } from '@/lib/config/tournament'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import {
  eventMobileMenuBackdrop,
  eventMobileMenuBadge,
  eventMobileMenuClose,
  eventMobileMenuCta,
  eventMobileMenuLink,
  eventMobileMenuNav,
  eventMobileMenuPanel,
  eventMobileMenuRoot,
  eventShellHeaderBrandSubtitle,
  eventShellHeaderBrandTitle,
} from '@/lib/ui/eventSurfaceStyles'

const ANIMATION_MS = 280

interface Props {
  open: boolean
  onClose: () => void
  normalizedPath: string
  closed: boolean
  entryCount: number | null
  navItems: AppNavItem[]
  activeNavItem: AppNavItem | null
}

export function TournamentMobileMenu({
  open,
  onClose,
  normalizedPath,
  closed,
  entryCount,
  navItems,
  activeNavItem,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!open || !mounted) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, mounted, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (open) {
      setMounted(true)
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
      return () => cancelAnimationFrame(frame)
    }

    setVisible(false)
    const timer = window.setTimeout(() => setMounted(false), ANIMATION_MS)
    return () => clearTimeout(timer)
  }, [open])

  if (!mounted) return null

  const { contacts } = tournamentInfo
  const registerActive = normalizedPath === routes.register

  return (
    <div
      className={eventMobileMenuRoot(visible)}
      role="dialog"
      aria-modal="true"
      aria-label="Меню сайта"
    >
      <Button
        type="button"
        variant="ghost"
        className={eventMobileMenuBackdrop(visible)}
        aria-label="Закрыть меню"
        onClick={onClose}
      />

      <div id="event-mobile-menu" className={eventMobileMenuPanel(visible)}>
        <div className="mb-3 flex items-center justify-between">
          <div className="min-w-0 leading-tight">
            <p className={eventShellHeaderBrandTitle}>Кубок ФСЕ СО</p>
            <p className={eventShellHeaderBrandSubtitle}>{tournamentInfo.venue.city}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className={eventMobileMenuClose}
            aria-label="Закрыть"
            onClick={onClose}
          >
            <X strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </div>

        <nav className={eventMobileMenuNav} aria-label="Разделы турнира">
          {navItems.map((item) => {
            const active = activeNavItem?.id === item.id
            return (
              <Link
                key={item.id}
                href={withBasePath(item.href)}
                className={eventMobileMenuLink(active)}
                aria-current={active ? 'page' : undefined}
                onClick={onClose}
              >
                <span>{item.label}</span>
                {item.id === 'athletes' && entryCount != null && entryCount > 0 && (
                  <span className={eventMobileMenuBadge}>{entryCount}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {!closed && (
          <Link
            href={withBasePath(routes.register)}
            className={eventMobileMenuCta(registerActive)}
            aria-current={registerActive ? 'page' : undefined}
            onClick={onClose}
          >
            <Button
              className={cn(
                'w-full min-h-11',
                registerActive && 'shadow-[0_0_0_2px_var(--color-accent-soft),0_0_0_3px_var(--color-accent)]',
              )}
            >
              Зарегистрироваться
            </Button>
          </Link>
        )}

        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-5 text-sm leading-[1.45]">
          <a href={`tel:${contacts.phone.replace(/[^\d+]/g, '')}`} className="text-muted transition-colors hover:text-accent">
            {contacts.phone}
          </a>
          <a href={`mailto:${contacts.email}`} className="text-muted transition-colors hover:text-accent">
            {contacts.email}
          </a>
          <a
            href={contacts.vk}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted transition-colors hover:text-accent"
          >
            {contacts.vkLabel}
          </a>
        </div>
      </div>
    </div>
  )
}
