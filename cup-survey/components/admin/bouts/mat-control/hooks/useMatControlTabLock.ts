'use client'

import { useEffect, useState } from 'react'

const TAB_LOCK_PREFIX = 'mat-control-tab-lock'

export function useMatControlTabLock(matIndex: number) {
  const [blocked, setBlocked] = useState(false)
  const lockKey = `${TAB_LOCK_PREFIX}:${matIndex}`

  useEffect(() => {
    if (typeof window === 'undefined') return

    const tabId = crypto.randomUUID()
    const claim = () => {
      const existing = window.localStorage.getItem(lockKey)
      if (!existing) {
        window.localStorage.setItem(lockKey, tabId)
      }
      setBlocked(window.localStorage.getItem(lockKey) !== tabId)
    }

    claim()
    const timer = window.setInterval(claim, 2000)

    const onStorage = (event: StorageEvent) => {
      if (event.key === lockKey) claim()
    }
    window.addEventListener('storage', onStorage)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('storage', onStorage)
      if (window.localStorage.getItem(lockKey) === tabId) {
        window.localStorage.removeItem(lockKey)
      }
    }
  }, [lockKey])

  return { blocked }
}
