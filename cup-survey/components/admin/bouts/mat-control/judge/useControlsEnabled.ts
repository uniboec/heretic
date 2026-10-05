'use client'

import { useEffect, useMemo, useState } from 'react'
import { SNAPSHOT_STALE_MS } from './judgeUtils'

export function useControlsEnabled(input: {
  leaseHeld: boolean
  busy: boolean
  lastSnapshotAt: number | null
  isRefreshing?: boolean
}): {
  controlsEnabled: boolean
  snapshotFresh: boolean
  disabledReason: string | null
} {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return useMemo(() => {
    const snapshotFresh =
      input.lastSnapshotAt != null &&
      (now - input.lastSnapshotAt < SNAPSHOT_STALE_MS || input.isRefreshing === true)

    if (!input.leaseHeld) {
      return {
        controlsEnabled: false,
        snapshotFresh,
        disabledReason: 'Захватите управление ковром',
      }
    }
    if (!snapshotFresh) {
      return {
        controlsEnabled: false,
        snapshotFresh,
        disabledReason: 'Нет актуальной связи с сервером',
      }
    }
    if (input.busy) {
      return {
        controlsEnabled: false,
        snapshotFresh,
        // Transient busy must not surface as a layout banner — controls stay disabled silently.
        disabledReason: null,
      }
    }
    return { controlsEnabled: true, snapshotFresh, disabledReason: null }
  }, [input.isRefreshing, input.leaseHeld, input.busy, input.lastSnapshotAt, now])
}
