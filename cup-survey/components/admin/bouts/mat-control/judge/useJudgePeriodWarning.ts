'use client'

import { useEffect, useRef } from 'react'
import type { BoutPeriod, BoutPhase, ClockState } from '@/lib/bouts/mat-control/types'
import { computeLivePeriodRemainingMs } from '@/lib/bouts/liveMatTimers'
import {
  fightTimerSoundPlayer,
  JUDGE_PERIOD_WARNING_SECONDS,
  JUDGE_PERIOD_WARNING_SOUND,
} from '@/lib/bouts/mat-control/sounds/fightTimerSounds'

const TICK_MS = 250

export function useJudgePeriodWarning(input: {
  enabled: boolean
  boutId: string | null
  boutPhase: BoutPhase | null | undefined
  clockState: ClockState | null | undefined
  currentPeriod: BoutPeriod | null | undefined
  liveRevision: number | null | undefined
  periodRemainingMs: number | null | undefined
  snapshotAnchoredAtMs: number | null | undefined
  warningSeconds?: number
}) {
  const warnedKeyRef = useRef<string | null>(null)
  const warningSeconds = input.warningSeconds ?? JUDGE_PERIOD_WARNING_SECONDS

  const periodKey =
    input.boutId && input.currentPeriod != null && input.liveRevision != null
      ? `${input.boutId}:${input.currentPeriod}:${input.liveRevision}`
      : null

  useEffect(() => {
    warnedKeyRef.current = null
  }, [periodKey])

  useEffect(() => {
    if (
      !input.enabled ||
      input.boutPhase !== 'live' ||
      input.clockState !== 'running' ||
      input.periodRemainingMs == null ||
      input.snapshotAnchoredAtMs == null ||
      !periodKey
    ) {
      return
    }

    const thresholdMs = warningSeconds * 1000

    function tick() {
      const remainingMs = computeLivePeriodRemainingMs({
        clockState: 'running',
        clockStartedAt: null,
        clockElapsedBeforeStartMs: 0,
        periodDurationMs: input.periodRemainingMs ?? 0,
        periodDeadlineAt: null,
        snapshotRemainingMs: input.periodRemainingMs ?? 0,
        snapshotAnchoredAtMs: input.snapshotAnchoredAtMs ?? null,
        nowMs: Date.now(),
      })
      if (remainingMs > thresholdMs || remainingMs <= 0) return
      if (warnedKeyRef.current === periodKey) return

      warnedKeyRef.current = periodKey
      void fightTimerSoundPlayer.play(JUDGE_PERIOD_WARNING_SOUND)
    }

    tick()
    const timer = window.setInterval(tick, TICK_MS)
    return () => window.clearInterval(timer)
  }, [
    input.enabled,
    input.boutPhase,
    input.clockState,
    input.periodRemainingMs,
    input.snapshotAnchoredAtMs,
    periodKey,
    warningSeconds,
  ])
}
