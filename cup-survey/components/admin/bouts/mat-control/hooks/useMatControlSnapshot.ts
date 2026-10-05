'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import type { MatControlSnapshot } from '@/lib/bouts/matControlSnapshot'

export function useMatControlSnapshot(matIndex: number) {
  const [snapshot, setSnapshot] = useState<MatControlSnapshot | null>(null)
  const [lastSnapshotAt, setLastSnapshotAt] = useState<number | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasSnapshotRef = useRef(false)
  const refreshInFlightRef = useRef<Promise<MatControlSnapshot | null> | null>(null)

  const refresh = useCallback(async (): Promise<MatControlSnapshot | null> => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current
    }

    const request = (async () => {
      setIsRefreshing(true)
      try {
        const res = await fetch(withBasePath(`/api/admin/bouts/mats/${matIndex}/control`))
        const result = await readJsonResponse<MatControlSnapshot & { error?: string }>(res)
        if (!result.ok) {
          if (!hasSnapshotRef.current) {
            setError(result.error ?? 'Не удалось загрузить состояние ковра')
            setLoading(false)
          }
          return null
        }
        const data = result.data ?? null
        setSnapshot((prev) => {
          if (
            data &&
            prev &&
            typeof data.session.revision === 'number' &&
            typeof prev.session.revision === 'number' &&
            data.session.revision < prev.session.revision
          ) {
            return prev
          }
          return data
        })
        setLastSnapshotAt(Date.now())
        setError(null)
        setLoading(false)
        hasSnapshotRef.current = data != null
        return data
      } catch {
        if (!hasSnapshotRef.current) {
          setError('Нет связи с сервером')
          setLoading(false)
        }
        return null
      } finally {
        setIsRefreshing(false)
        refreshInFlightRef.current = null
      }
    })()

    refreshInFlightRef.current = request
    return request
  }, [matIndex])

  useEffect(() => {
    void refresh().catch(() => undefined)

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void refresh().catch(() => undefined)
    }, 4000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refresh().catch(() => undefined)
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const activeBout = snapshot?.activeBout ?? null
  const nextBout = snapshot?.queue.nextAvailable?.bout ?? null

  const applySnapshot = useCallback((data: MatControlSnapshot) => {
    setSnapshot(data)
    setLastSnapshotAt(Date.now())
    setError(null)
    setLoading(false)
    hasSnapshotRef.current = true
  }, [])

  return {
    snapshot,
    activeBout,
    nextBout,
    lastSnapshotAt,
    isRefreshing,
    loading,
    error,
    setError,
    refresh,
    applySnapshot,
  }
}
