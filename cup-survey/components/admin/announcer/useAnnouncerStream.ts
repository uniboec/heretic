'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import type { AnnouncerDashboardDto } from '@/lib/announcer/dto/admin'

export function useAnnouncerStream() {
  const [dashboard, setDashboard] = useState<AnnouncerDashboardDto | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sourceRef = useRef<EventSource | null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(withBasePath('/api/admin/announcer/events'), { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to load announcer dashboard')
      const data = (await response.json()) as AnnouncerDashboardDto
      setDashboard(data)
      setError(null)
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load announcer dashboard'
      setError(message)
      return null
    }
  }, [])

  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      pollTimer = setInterval(() => {
        void refresh().catch(() => undefined)
      }, 3000)
    }

    if (typeof EventSource === 'undefined') {
      void refresh().catch((err) => setError(err instanceof Error ? err.message : 'load failed'))
      startPolling()
      return () => {
        if (pollTimer) clearInterval(pollTimer)
      }
    }

    const source = new EventSource(withBasePath('/api/admin/announcer/stream'))
    sourceRef.current = source

    source.onopen = () => {
      setConnected(true)
      setError(null)
    }

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as AnnouncerDashboardDto
        setDashboard(data)
      } catch {
        setError('Invalid stream payload')
      }
    }

    source.onerror = () => {
      setConnected(false)
      setError('SSE disconnected, using polling')
      source.close()
      void refresh().catch(() => undefined)
      startPolling()
    }

    return () => {
      source.close()
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [refresh])

  return { dashboard, connected, error, refresh, setDashboard }
}
