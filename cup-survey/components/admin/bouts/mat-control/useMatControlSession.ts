'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'

const HEARTBEAT_MS = 30_000

function createHolderToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `holder-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function holderTokenStorageKey(matIndex: number): string {
  return `mat-control-holder:${matIndex}`
}

function loadOrCreateHolderToken(matIndex: number): string {
  const storageKey = holderTokenStorageKey(matIndex)
  const existing = window.sessionStorage.getItem(storageKey)
  if (existing) return existing
  const token = createHolderToken()
  window.sessionStorage.setItem(storageKey, token)
  return token
}

function readLeaseErrorCode(body: unknown): string {
  if (!body || typeof body !== 'object' || !('code' in body)) {
    return ''
  }
  return String((body as { code?: string }).code ?? '')
}

function isLeaseConflict(result: {
  ok: boolean
  status: number
  error?: string
  code?: string
}): boolean {
  return (
    !result.ok &&
    (result.status === 403 ||
      result.code === 'LEASE_NOT_HELD' ||
      result.code === 'LEASE_STALE' ||
      (result.error?.includes('занят') ?? false) ||
      (result.error?.includes('устарел') ?? false))
  )
}

export function useMatControlSession(matIndex: number) {
  const holderTokenRef = useRef<string | null>(null)
  const leaseGenerationRef = useRef(0)
  const recoverInFlightRef = useRef<Promise<boolean> | null>(null)
  const [holderToken, setHolderToken] = useState<string | null>(null)
  const [leaseHeld, setLeaseHeld] = useState(false)
  const [leaseError, setLeaseError] = useState<string | null>(null)

  useEffect(() => {
    leaseGenerationRef.current += 1
    const token = loadOrCreateHolderToken(matIndex)
    holderTokenRef.current = token
    setHolderToken(token)
    setLeaseHeld(false)
    setLeaseError(null)
  }, [matIndex])

  const postLeaseAction = useCallback(
    async (action: 'acquire' | 'heartbeat' | 'release' | 'takeover'): Promise<{
      ok: boolean
      status: number
      error?: string
      code?: string
    }> => {
      const token = holderTokenRef.current
      if (!token) {
        return { ok: false, status: 0, error: 'Токен сессии не готов' }
      }

      const res = await fetch(
        withBasePath(`/api/admin/bouts/mats/${matIndex}/lease/${action}`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ holderToken: token }),
        },
      )
      const result = await readJsonResponse<{ error?: string; code?: string }>(res)
      return {
        ok: result.ok,
        status: result.status,
        error: result.ok ? undefined : result.error,
        code: result.ok ? undefined : readLeaseErrorCode(result.body),
      }
    },
    [matIndex],
  )

  const applyLeaseSuccess = useCallback((generation: number) => {
    if (generation !== leaseGenerationRef.current) return false
    setLeaseHeld(true)
    setLeaseError(null)
    return true
  }, [])

  const recoverLease = useCallback(
    async (preferTakeover = false): Promise<boolean> => {
      if (recoverInFlightRef.current) {
        return recoverInFlightRef.current
      }

      const generation = leaseGenerationRef.current

      const request = (async () => {
        try {
          const tryTakeover = async () => {
            const result = await postLeaseAction('takeover')
            if (result.ok) {
              return applyLeaseSuccess(generation)
            }
            return false
          }

          const tryAcquire = async () => {
            const result = await postLeaseAction('acquire')
            if (result.ok) {
              return applyLeaseSuccess(generation)
            }
            if (isLeaseConflict(result)) {
              return tryTakeover()
            }
            return false
          }

          const recovered = preferTakeover
            ? (await tryTakeover()) || (await tryAcquire())
            : await tryAcquire()

          if (generation !== leaseGenerationRef.current) {
            return false
          }

          if (!recovered) {
            setLeaseHeld(false)
            setLeaseError('Не удалось захватить управление ковром')
          }
          return recovered
        } catch {
          if (generation !== leaseGenerationRef.current) {
            return false
          }
          setLeaseHeld(false)
          setLeaseError('Нет связи с сервером')
          return false
        } finally {
          recoverInFlightRef.current = null
        }
      })()

      recoverInFlightRef.current = request
      return request
    },
    [applyLeaseSuccess, postLeaseAction],
  )

  const takeover = useCallback(async (): Promise<boolean> => {
    return recoverLease(true)
  }, [recoverLease])

  const acquire = useCallback(async (): Promise<boolean> => {
    return recoverLease(false)
  }, [recoverLease])

  const heartbeat = useCallback(async () => {
    const generation = leaseGenerationRef.current

    try {
      const result = await postLeaseAction('heartbeat')
      if (generation !== leaseGenerationRef.current) {
        return false
      }

      if (result.ok) {
        return true
      }

      if (isLeaseConflict(result)) {
        return recoverLease(true)
      }

      setLeaseHeld(false)
      setLeaseError(result.error ?? 'Сессия управления устарела')
      return false
    } catch {
      return false
    }
  }, [postLeaseAction, recoverLease])

  const release = useCallback(async () => {
    try {
      const result = await postLeaseAction('release')
      if (!result.ok) {
        setLeaseError(result.error ?? 'Не удалось освободить управление')
        return false
      }
      setLeaseHeld(false)
      setLeaseError(null)
      return true
    } catch {
      setLeaseError('Нет связи с сервером')
      return false
    }
  }, [postLeaseAction])

  useEffect(() => {
    if (!holderToken) return

    let cancelled = false
    void acquire().then((ok) => {
      if (cancelled && ok) {
        setLeaseHeld(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [holderToken, acquire])

  useEffect(() => {
    if (!leaseHeld) return
    const timer = window.setInterval(() => {
      void heartbeat().catch(() => undefined)
    }, HEARTBEAT_MS)
    return () => window.clearInterval(timer)
  }, [leaseHeld, heartbeat])

  useEffect(() => {
    if (!holderToken) return

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void recoverLease(true).catch(() => undefined)
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [holderToken, recoverLease])

  return {
    holderToken,
    leaseHeld,
    leaseError,
    acquire,
    release,
    takeover,
  }
}
