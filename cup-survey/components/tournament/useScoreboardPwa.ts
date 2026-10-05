'use client'

import { useEffect, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import type { MatScoreboardSnapshot } from '@/lib/bouts/matScoreboardSnapshot'

const STORAGE_PREFIX = 'scoreboard-pwa:'

export function scoreboardCacheKey(matIndex: number): string {
  return `${STORAGE_PREFIX}${matIndex}`
}

export function readCachedScoreboard(matIndex: number): MatScoreboardSnapshot | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(scoreboardCacheKey(matIndex))
  if (!raw) return null
  try {
    return JSON.parse(raw) as MatScoreboardSnapshot
  } catch {
    return null
  }
}

export function writeCachedScoreboard(matIndex: number, snapshot: MatScoreboardSnapshot): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(scoreboardCacheKey(matIndex), JSON.stringify(snapshot))
}

export function useScoreboardPwa(matIndex: number) {
  const [offline, setOffline] = useState(false)
  const [installable, setInstallable] = useState(false)

  useEffect(() => {
    setOffline(!navigator.onLine)
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const swUrl = withBasePath('/scoreboard-sw.js')
    void navigator.serviceWorker.register(swUrl, { scope: withBasePath('/scoreboard/') })
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallable(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  return { offline, installable }
}
