'use client'

import { useEffect, useState } from 'react'
import { computeLivePeriodRemainingMs, LIVE_TIMER_TICK_MS } from '@/lib/bouts/liveMatTimers'

export function useLivePeriodRemaining(
  active:
    | {
        periodRemainingMs: number
        periodDurationMs?: number
        periodDeadlineAt: string | null
        clockRunning: boolean
        clockElapsedBeforeStartMs?: number
        clockStartedAt?: string | null
      }
    | null
    | undefined,
) {
  const [remainingMs, setRemainingMs] = useState(active?.periodRemainingMs ?? 0)

  useEffect(() => {
    if (!active) {
      setRemainingMs(0)
      return
    }

    if (!active.clockRunning) {
      setRemainingMs(active.periodRemainingMs)
      return
    }

    const snapshotAnchoredAtMs = Date.now()

    function tick() {
      if (!active) return
      setRemainingMs(
        computeLivePeriodRemainingMs({
          clockState: 'running',
          clockStartedAt: active.clockStartedAt ?? null,
          clockElapsedBeforeStartMs: active.clockElapsedBeforeStartMs ?? 0,
          periodDurationMs: active.periodDurationMs ?? active.periodRemainingMs,
          periodDeadlineAt: active.periodDeadlineAt,
          snapshotRemainingMs: active.periodRemainingMs,
          snapshotAnchoredAtMs,
          nowMs: Date.now(),
        }),
      )
    }

    tick()
    const timer = window.setInterval(tick, LIVE_TIMER_TICK_MS)
    return () => window.clearInterval(timer)
  }, [
    active?.periodRemainingMs,
    active?.periodDeadlineAt,
    active?.clockRunning,
    active?.clockElapsedBeforeStartMs,
    active?.clockStartedAt,
    active?.periodDurationMs,
  ])

  return remainingMs
}
