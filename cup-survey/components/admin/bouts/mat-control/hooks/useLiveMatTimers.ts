'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MatControlBoutSnapshot } from '@/lib/bouts/matControlSnapshot'
import {
  computeLiveAuxiliaryTimers,
  computeLivePeriodRemainingMs,
  LIVE_TIMER_TICK_MS,
  matTimersNeedLiveTick,
} from '@/lib/bouts/liveMatTimers'

export function useLiveMatTimers(
  activeBout: MatControlBoutSnapshot | null,
  snapshotAnchoredAtMs: number | null,
) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  const needsTick = activeBout
    ? activeBout.execution.boutPhase === 'scheduled' ||
      activeBout.execution.boutPhase === 'live' ||
      matTimersNeedLiveTick({
        clockState: activeBout.execution.clockState,
        auxiliaryTimers: activeBout.auxiliaryTimers,
      })
    : false

  const cornerTimerKey = (
    timers:
      | MatControlBoutSnapshot['auxiliaryTimers']['athleteWaits']
      | MatControlBoutSnapshot['auxiliaryTimers']['athleteDoctorVisits']
      | MatControlBoutSnapshot['auxiliaryTimers']['athleteEquipmentCorrections'],
  ) =>
    timers
      ? Object.entries(timers)
          .map(([corner, timer]) =>
            timer
              ? `${corner}:${timer.isActive ? 'a' : 'p'}:${timer.startedAt ?? ''}:${timer.accumulatedMs}`
              : '',
          )
          .join('|')
      : ''

  const tickKey = activeBout
    ? [
        activeBout.boutId,
        activeBout.execution.boutPhase,
        activeBout.execution.clockState,
        activeBout.periodDeadlineAt,
        activeBout.periodRemainingMs,
        snapshotAnchoredAtMs,
        activeBout.execution.clockElapsedBeforeStartMs,
        cornerTimerKey(activeBout.auxiliaryTimers.athleteWaits),
        cornerTimerKey(activeBout.auxiliaryTimers.athleteDoctorVisits),
        cornerTimerKey(activeBout.auxiliaryTimers.athleteEquipmentCorrections),
        activeBout.auxiliaryTimers.passivity?.startedAt ?? '',
      ].join(':')
    : null

  useEffect(() => {
    setNowMs(Date.now())
    if (!needsTick) return
    const timer = window.setInterval(() => setNowMs(Date.now()), LIVE_TIMER_TICK_MS)
    return () => window.clearInterval(timer)
  }, [needsTick, tickKey])

  return useMemo(() => {
    if (!activeBout) return null

    const { execution } = activeBout
    return {
      periodRemainingMs: computeLivePeriodRemainingMs({
        clockState: execution.clockState,
        clockStartedAt: execution.clockStartedAt,
        clockElapsedBeforeStartMs: execution.clockElapsedBeforeStartMs,
        periodDurationMs: activeBout.periodDurationMs,
        periodDeadlineAt: activeBout.periodDeadlineAt,
        snapshotRemainingMs: activeBout.periodRemainingMs,
        snapshotAnchoredAtMs,
        nowMs,
      }),
      auxiliaryTimers: computeLiveAuxiliaryTimers(activeBout.auxiliaryTimers, nowMs, execution),
    }
  }, [activeBout, nowMs, snapshotAnchoredAtMs])
}
