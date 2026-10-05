'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  createClientClock,
  readClientBoutElapsedMs,
  restoreClientClockAfterReload,
  startClientClock,
  pauseClientClock,
  stopClientClock,
  type ClientClockSnapshot,
} from '@/lib/bouts/matControlReliability/clockFsm'

const STORAGE_KEY = 'mat-control-client-clock'

function loadStoredClock(boutId: string | null): ClientClockSnapshot | null {
  if (!boutId || typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(`${STORAGE_KEY}:${boutId}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ClientClockSnapshot
  } catch {
    return null
  }
}

function storeClock(boutId: string | null, snapshot: ClientClockSnapshot | null) {
  if (!boutId || typeof window === 'undefined') return
  if (!snapshot) {
    window.sessionStorage.removeItem(`${STORAGE_KEY}:${boutId}`)
    return
  }
  window.sessionStorage.setItem(`${STORAGE_KEY}:${boutId}`, JSON.stringify(snapshot))
}

export function useClientFightClock(boutId: string | null, serverClockRunning: boolean) {
  const [clock, setClock] = useState<ClientClockSnapshot>(() => {
    const stored = loadStoredClock(boutId)
    if (!stored) return createClientClock()
    return restoreClientClockAfterReload(stored, performance.now())
  })

  useEffect(() => {
    const stored = loadStoredClock(boutId)
    if (!stored) {
      setClock(createClientClock())
      return
    }
    setClock(restoreClientClockAfterReload(stored, performance.now()))
  }, [boutId])

  useEffect(() => {
    storeClock(boutId, clock)
  }, [boutId, clock])

  useEffect(() => {
    if (!serverClockRunning && clock.state === 'RUNNING') {
      setClock((prev) => pauseClientClock(prev, performance.now()))
    }
  }, [serverClockRunning, clock.state])

  const boutElapsedMs = useMemo(
    () => readClientBoutElapsedMs(clock, performance.now()),
    [clock],
  )

  return {
    clock,
    boutElapsedMs,
    start: () => setClock((prev) => startClientClock(prev, performance.now())),
    pause: () => setClock((prev) => pauseClientClock(prev, performance.now())),
    stop: () => setClock((prev) => stopClientClock(prev, performance.now())),
  }
}
