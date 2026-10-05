'use client'

import { useEffect } from 'react'
import {
  CLIENT_RELEASE_ATTEMPT_KEY,
  CLIENT_RELEASE_STORAGE_KEY,
} from '@/lib/clientReleaseConstants'

const POLL_MS = process.env.NODE_ENV === 'development' ? 60_000 : 5 * 60_000
const MAX_ATTEMPTS = 2

function readMetaReleaseId(): string | null {
  return document.querySelector('meta[name="cup-release-id"]')?.getAttribute('content')?.trim() || null
}

async function fetchReleaseId(): Promise<string | null> {
  try {
    const response = await fetch('/api/client-release', { cache: 'no-store' })
    if (!response.ok) return null

    const data = (await response.json()) as { releaseId?: string }
    return typeof data.releaseId === 'string' ? data.releaseId : null
  } catch {
    return null
  }
}

function isStyleBroken(): boolean {
  const usesDnaUtilities =
    document.querySelector('[class*="bg-info-soft"], .rounded-card') !== null
  if (!usesDnaUtilities) return false

  const root = getComputedStyle(document.documentElement)
  const infoSoft = root.getPropertyValue('--color-info-soft').trim()
  const radiusCard = root.getPropertyValue('--radius-card').trim()

  return infoSoft !== '#eef4ff' || (radiusCard !== '0.75rem' && radiusCard !== '12px')
}

function getAttemptCount(): number {
  const raw = sessionStorage.getItem(CLIENT_RELEASE_ATTEMPT_KEY)
  const parsed = raw ? Number.parseInt(raw, 10) : 0
  return Number.isFinite(parsed) ? parsed : 0
}

function incrementAttemptCount(): number {
  const next = getAttemptCount() + 1
  sessionStorage.setItem(CLIENT_RELEASE_ATTEMPT_KEY, String(next))
  return next
}

function resetAttemptCount(): void {
  sessionStorage.removeItem(CLIENT_RELEASE_ATTEMPT_KEY)
}

async function hardRefreshWithClearSiteData(releaseId: string): Promise<void> {
  localStorage.setItem(CLIENT_RELEASE_STORAGE_KEY, releaseId)

  const returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const refreshUrl = new URL('/api/client-release/refresh', window.location.origin)
  refreshUrl.searchParams.set('return', returnPath || '/')
  window.location.replace(refreshUrl.toString())
}

async function recoverIfNeeded(source: 'poll'): Promise<void> {
  const releaseId = await fetchReleaseId()
  if (!releaseId) return

  const stored = localStorage.getItem(CLIENT_RELEASE_STORAGE_KEY)
  if (stored && stored !== releaseId) {
    localStorage.setItem(CLIENT_RELEASE_STORAGE_KEY, releaseId)
    await hardRefreshWithClearSiteData(releaseId)
    return
  }

  if (!isStyleBroken()) {
    resetAttemptCount()
    return
  }

  const attempt = incrementAttemptCount()
  if (attempt >= MAX_ATTEMPTS) return

  await hardRefreshWithClearSiteData(releaseId)
}

function cleanReleaseQueryFromUrl(): void {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('_release') && !url.searchParams.has('_style_refresh')) return

  url.searchParams.delete('_release')
  url.searchParams.delete('_style_refresh')
  window.history.replaceState({}, '', url.toString())
}

export function ClientReleaseSync() {
  useEffect(() => {
    cleanReleaseQueryFromUrl()

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void recoverIfNeeded('poll')
      }
    }

    document.addEventListener('visibilitychange', onVisible)
    const intervalId = window.setInterval(() => {
      void recoverIfNeeded('poll')
    }, POLL_MS)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(intervalId)
    }
  }, [])

  return null
}
